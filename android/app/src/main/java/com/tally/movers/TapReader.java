package com.tally.movers;

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.stripe.stripeterminal.Terminal;
import com.stripe.stripeterminal.external.callable.Callback;
import com.stripe.stripeterminal.external.callable.Cancelable;
import com.stripe.stripeterminal.external.callable.ConnectionTokenCallback;
import com.stripe.stripeterminal.external.callable.ConnectionTokenProvider;
import com.stripe.stripeterminal.external.callable.PaymentIntentCallback;
import com.stripe.stripeterminal.external.callable.ReaderCallback;
import com.stripe.stripeterminal.external.callable.TapToPayReaderListener;
import com.stripe.stripeterminal.external.callable.TerminalListener;
import com.stripe.stripeterminal.external.models.CollectPaymentIntentConfiguration;
import com.stripe.stripeterminal.external.models.ConfirmPaymentIntentConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionConfiguration;
import com.stripe.stripeterminal.external.models.ConnectionStatus;
import com.stripe.stripeterminal.external.models.ConnectionTokenException;
import com.stripe.stripeterminal.external.models.DisconnectReason;
import com.stripe.stripeterminal.external.models.DiscoveryConfiguration;
import com.stripe.stripeterminal.external.models.EasyConnectConfiguration.TapToPayEasyConnectConfiguration;
import com.stripe.stripeterminal.external.models.LocaleConfig;
import com.stripe.stripeterminal.external.models.PaymentIntent;
import com.stripe.stripeterminal.external.models.PaymentStatus;
import com.stripe.stripeterminal.external.models.Reader;
import com.stripe.stripeterminal.external.models.TapUseCase;
import com.stripe.stripeterminal.external.models.TerminalErrorCode;
import com.stripe.stripeterminal.external.models.TerminalException;
import com.stripe.stripeterminal.log.LogLevel;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/**
 * Tap to pay (batch 15b, Nov 25): the customer taps their card or phone on the back of this phone, through Stripe
 * Terminal's Tap to Pay on Android.
 *
 * The page asks for a payment with TallyNative.tapPay(id, {secret, location, live, account, merchant}): the server made
 * the payment (a card_present PaymentIntent) and named the company's Terminal location. This connects the phone's
 * reader on that location (a pretend reader in Stripe test mode, which taps a test Visa by itself), lets Stripe's own
 * screen take the tap, and answers the page through window.__tallyNativeDone(id, {ok, pi} | {canceled} | {code,
 * message}). The reader signs in with a connection token the page gets from the server: the reader asks for one
 * (fetchConnectionToken), the page is asked (window.__tallyTapToken(id)), and it answers with TallyNative.tapToken.
 *
 * Stripe needs the phone's location for every tap (it is asked for the first time here, if MoveCrew doesn't have it),
 * Android 13 or later, NFC, Google Play, and Developer options off; Stripe's screen says what is missing.
 */
final class TapReader implements ConnectionTokenProvider, TerminalListener, TapToPayReaderListener {
    private static final String TAG = "TallyTap";
    private final MainActivity act;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, ConnectionTokenCallback> tokenWait = new HashMap<>();
    private int tokenSeq;
    private volatile String payId; // the page's id for the payment going now (one at a time)
    private long payAt;            // when it started
    private JSONObject payArgs;    // and what the server said about it
    private Cancelable running;    // the connection or the tap going now
    private volatile String readerFor = ""; // the account, mode and location the connected reader is on

    TapReader(MainActivity act) {
        this.act = act;
    }

    /* Whether this phone can take a tap at all: Android 13 or later, with NFC. The rest (Google Play, a locked
       bootloader, Developer options off) Stripe checks when the reader connects, and says. */
    static String check(Context c) {
        try {
            JSONObject o = new JSONObject();
            if (Build.VERSION.SDK_INT < 33) return o.put("ok", false).put("why", "android").toString();
            if (!c.getPackageManager().hasSystemFeature(PackageManager.FEATURE_NFC)) return o.put("ok", false).put("why", "nfc").toString();
            return o.put("ok", true).toString();
        } catch (Exception e) {
            return "{\"ok\":false}";
        }
    }

    void pay(String id, String json) {
        if (payId != null && System.currentTimeMillis() - payAt > 6 * 60 * 1000) {
            // the page gave up on that one long ago (it waits five minutes): let it go
            Cancelable c = running;
            running = null;
            if (c != null) {
                try {
                    c.cancel(new Callback() {
                        @Override
                        public void onSuccess() {
                        }

                        @Override
                        public void onFailure(TerminalException e) {
                        }
                    });
                } catch (Exception e) {
                    Log.w(TAG, "Old tap not canceled: " + e);
                }
            }
            payId = null;
            payArgs = null;
        }
        if (payId != null) {
            answer(id, fail("BUSY", "A tap payment is already going on this phone."));
            return;
        }
        try {
            payArgs = new JSONObject(json);
        } catch (Exception e) {
            answer(id, fail("ARGS", "The payment didn't start. Try again."));
            return;
        }
        if (payArgs.optString("secret").isEmpty() || payArgs.optString("location").isEmpty()) {
            payArgs = null;
            answer(id, fail("ARGS", "The payment didn't start. Try again."));
            return;
        }
        payId = id;
        payAt = System.currentTimeMillis();
        if (!act.tapHasLocation()) {
            act.tapAskLocation();   // goes on in onLocation
            return;
        }
        start();
    }

    /* Android's answer about the phone's location, asked for by pay(). */
    void onLocation(boolean granted) {
        if (payId == null) return;
        if (!granted) {
            finish(fail("LOCATION_PERMISSION", "Tap to pay needs the phone's location."));
            return;
        }
        start();
    }

    private void start() {
        try {
            if (!Terminal.isInitialized()) {
                Terminal.init(act.getApplicationContext(), LogLevel.NONE, this, this, null,
                        new LocaleConfig.HardcodedLocale.Builder("en-US").build());
            }
        } catch (Exception e) {
            Log.w(TAG, "Terminal didn't start: " + e);
            finish(fail("INIT", "Tap to pay couldn't start on this phone."));
            return;
        }
        final String acct = payArgs.optString("account"), loc = payArgs.optString("location");
        final String want = acct + "|" + payArgs.optBoolean("live") + "|" + loc;
        final Terminal t = Terminal.getInstance();
        final Reader r = t.getConnectedReader();
        if (r != null && want.equals(readerFor)) {
            take();
            return;
        }
        // another account, mode or location than the reader is on (or none yet): it signs in again for this one
        final boolean otherAccount = !readerFor.isEmpty() && !readerFor.split("\\|", -1)[0].equals(acct);
        if (r == null) {
            connect(loc, want, otherAccount);
            return;
        }
        t.disconnectReader(new Callback() {
            @Override
            public void onSuccess() {
                main.post(() -> connect(loc, want, otherAccount));
            }

            @Override
            public void onFailure(TerminalException e) {
                main.post(() -> connect(loc, want, otherAccount));
            }
        });
    }

    private void connect(String loc, final String want, boolean otherAccount) {
        if (payArgs == null) return;
        readerFor = "";
        if (otherAccount) {
            try {
                Terminal.getInstance().clearCachedCredentials();
            } catch (Exception e) {
                Log.w(TAG, "Credentials kept: " + e);
            }
        }
        boolean pretend = !payArgs.optBoolean("live");
        String merchant = payArgs.optString("merchant");
        TapToPayEasyConnectConfiguration cfg = new TapToPayEasyConnectConfiguration(
                new DiscoveryConfiguration.TapToPayDiscoveryConfiguration(pretend),
                new ConnectionConfiguration.TapToPayConnectionConfiguration(new TapUseCase.Pay(loc), true, this,
                        merchant.isEmpty() ? null : merchant));
        running = Terminal.getInstance().easyConnect(cfg, new ReaderCallback() {
            @Override
            public void onSuccess(Reader reader) {
                main.post(() -> {
                    running = null;
                    readerFor = want;
                    take();
                });
            }

            @Override
            public void onFailure(TerminalException e) {
                main.post(() -> {
                    running = null;
                    finish(fail(e));
                });
            }
        });
    }

    private void take() {
        if (payArgs == null) return;
        Terminal.getInstance().retrievePaymentIntent(payArgs.optString("secret"), new PaymentIntentCallback() {
            @Override
            public void onSuccess(final PaymentIntent pi) {
                main.post(() -> {
                    if (payId == null) return;
                    running = Terminal.getInstance().processPaymentIntent(pi,
                            new CollectPaymentIntentConfiguration.Builder().build(),
                            new ConfirmPaymentIntentConfiguration.Builder().build(),
                            new PaymentIntentCallback() {
                                @Override
                                public void onSuccess(PaymentIntent done) {
                                    main.post(() -> {
                                        running = null;
                                        finish(ok(done.getId()));
                                    });
                                }

                                @Override
                                public void onFailure(TerminalException e) {
                                    main.post(() -> {
                                        running = null;
                                        finish(fail(e));
                                    });
                                }
                            });
                });
            }

            @Override
            public void onFailure(TerminalException e) {
                main.post(() -> finish(fail(e)));
            }
        });
    }

    private void finish(String result) {
        String id = payId;
        payId = null;
        payArgs = null;
        if (id != null) answer(id, result);
    }

    private void answer(String id, String result) {
        act.tapJs("window.__tallyNativeDone&&window.__tallyNativeDone(" + JSONObject.quote(id) + "," + result + ")", null);
    }

    private static String ok(String pi) {
        try {
            return new JSONObject().put("ok", true).put("pi", pi == null ? "" : pi).toString();
        } catch (Exception e) {
            return "{\"ok\":true}";
        }
    }

    private static String fail(String code, String message) {
        try {
            return new JSONObject().put("ok", false).put("code", code).put("message", message).toString();
        } catch (Exception e) {
            return "{\"ok\":false}";
        }
    }

    private static String fail(TerminalException e) {
        TerminalErrorCode c = e.getErrorCode();
        Log.w(TAG, "Tap: " + c + " " + e.getErrorMessage());
        try {
            JSONObject o = new JSONObject().put("ok", false).put("code", c == null ? "" : c.name()).put("message", e.getErrorMessage());
            if (c == TerminalErrorCode.CANCELED || c == TerminalErrorCode.CANCELED_BY_READER) o.put("canceled", true);
            return o.toString();
        } catch (Exception x) {
            return "{\"ok\":false}";
        }
    }

    /* ---------- the reader signing in: a connection token from the server, through the page ---------- */
    @Override
    public void fetchConnectionToken(ConnectionTokenCallback cb) {
        final String id;
        synchronized (tokenWait) {
            id = "k" + (++tokenSeq);
            tokenWait.put(id, cb);
        }
        act.tapJs("window.__tallyTapToken?window.__tallyTapToken(" + JSONObject.quote(id) + "):false", v -> {
            if (!"true".equals(v)) token(id, "", "MoveCrew isn't ready yet. Try again in a moment.");
        });
        main.postDelayed(() -> token(id, "", "MoveCrew didn't answer. Check the connection and try again."), 30000);
    }

    /* The page's answer: the token, or why there isn't one. */
    void token(String id, String secret, String err) {
        ConnectionTokenCallback cb;
        synchronized (tokenWait) {
            cb = tokenWait.remove(id);
        }
        if (cb == null) return;
        if (secret != null && !secret.isEmpty()) cb.onSuccess(secret);
        else cb.onFailure(new ConnectionTokenException(err == null || err.isEmpty() ? "The reader could not sign in." : err));
    }

    /* ---------- what the reader says ---------- */
    @Override
    public void onConnectionStatusChange(ConnectionStatus status) {
        Log.i(TAG, "Reader: " + status);
        if (status == ConnectionStatus.NOT_CONNECTED) readerFor = "";
    }

    @Override
    public void onPaymentStatusChange(PaymentStatus status) {
        Log.i(TAG, "Payment: " + status);
    }

    @Override
    public void onDisconnect(DisconnectReason reason) {
        Log.i(TAG, "Reader disconnected: " + reason);
        readerFor = "";
    }

    @Override
    public void onReaderReconnectStarted(Reader reader, Cancelable cancelReconnect, DisconnectReason reason) {
        Log.i(TAG, "Reader reconnecting: " + reason);
    }

    @Override
    public void onReaderReconnectSucceeded(Reader reader) {
        Log.i(TAG, "Reader reconnected");
    }

    @Override
    public void onReaderReconnectFailed(Reader reader) {
        Log.i(TAG, "Reader didn't reconnect");
        readerFor = "";
    }

    // (onUpdateRequirementsAvailable, Stripe's notice of an Android, security patch or SDK update this phone will need,
    // keeps Stripe's own handling: it only tells, and changes nothing)
}
