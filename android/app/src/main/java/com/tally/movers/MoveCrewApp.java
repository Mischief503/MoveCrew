package com.tally.movers;

import android.app.Application;

import com.stripe.stripeterminal.TerminalApplicationDelegate;
import com.stripe.stripeterminal.taptopay.TapToPay;

/**
 * MoveCrew for Android, the app as a whole. Tap to pay (batch 15b): Stripe Terminal follows the app's comings and
 * goings from here, as Stripe asks. Stripe's own Tap to Pay screen runs in a process of its own, where nothing of
 * MoveCrew's starts.
 */
public class MoveCrewApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        if (TapToPay.isInTapToPayProcess()) return;
        TerminalApplicationDelegate.onCreate(this);
    }
}
