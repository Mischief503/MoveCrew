package com.movecrew.desktop
import com.movecrew.domain.*
import java.awt.*
import javax.swing.*
fun main()=SwingUtilities.invokeLater{
 val f=JFrame("MoveCrew");f.defaultCloseOperation=JFrame.EXIT_ON_CLOSE;f.layout=BorderLayout()
 f.add(JLabel("MoveCrew — Windows Production",SwingConstants.CENTER).apply{font=font.deriveFont(Font.BOLD,24f);border=BorderFactory.createEmptyBorder(18,10,18,10)},BorderLayout.NORTH)
 val tabs=JTabbedPane();RoleNavigation.sections(setOf(CompanyRole.OWNER)).forEach{s->tabs.addTab(s.name.replace('_',' '),JLabel("${s.name.replace('_',' ')} workspace",SwingConstants.CENTER))};f.add(tabs,BorderLayout.CENTER)
 f.setSize(1200,800);f.setLocationRelativeTo(null);f.isVisible=true
}
