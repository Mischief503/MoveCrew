package com.movecrew.desktoptest
import com.movecrew.testsupport.*
import java.awt.*
import javax.swing.*
fun main()=SwingUtilities.invokeLater{
 val people=FakeCompany.users;val switcher=TestUserSwitcher();val f=JFrame("MoveCrew — Test Company");f.defaultCloseOperation=JFrame.EXIT_ON_CLOSE
 val combo=JComboBox(people.map{"${it.identity.displayName} — ${it.role}"}.toTypedArray());val status=JLabel("Choose an artificial company user",SwingConstants.CENTER);val button=JButton("Switch Test Identity")
 button.addActionListener{val p=people[combo.selectedIndex];val s=switcher.switchTo(p.identity.id);status.text="Viewing as ${p.identity.displayName} (${p.role}) • ${s.sessionId.take(8)}…"}
 f.layout=BorderLayout(12,12);f.add(JLabel("MoveCrew Test Company",SwingConstants.CENTER).apply{font=font.deriveFont(Font.BOLD,24f)},BorderLayout.NORTH);f.add(JPanel(GridLayout(3,1,8,8)).apply{add(combo);add(button);add(status)},BorderLayout.CENTER);f.add(JLabel("Debug/test build only — not in production desktop.",SwingConstants.CENTER),BorderLayout.SOUTH);f.setSize(760,360);f.setLocationRelativeTo(null);f.isVisible=true
}
