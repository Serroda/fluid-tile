import QtQuick
import org.kde.kirigami as Kirigami

Item {
    property color windowFullscreenBackground: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.backgroundColor, 0.60)

    property color windowBackground: Kirigami.Theme.backgroundColor

    property int radius: Kirigami.Units.cornerRadius

    property color tileFocus: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.focusColor, 0.88)

    property color tileBackground: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.backgroundColor, 0.60)

    property color tileBorder: Kirigami.ColorUtils.tintWithAlpha("transparent", Kirigami.Theme.textColor, 0.54)
}
