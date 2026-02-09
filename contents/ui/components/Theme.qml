import QtQuick
import org.kde.kirigami as Kirigami

Item {
  property color windowBackground: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.backgroundColor, 0.40)
  
  property int tileRadius: Kirigami.Units.cornerRadius
  
  property color tileFocus: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.focusColor, 0.88)
  
  property color tileBackground: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.backgroundColor, 0.60)
  
  property color tileBorder: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.textColor, 0.54)
  
}
