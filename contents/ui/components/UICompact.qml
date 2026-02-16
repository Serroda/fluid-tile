import QtQuick

Rectangle {
    id: windowCompact
    width: 180 * screens.length
    height: 140

    anchors.centerIn: parent
    property var screens: []
    property int tileActived: -1
    property var theme: ({})
    property var layoutOrdered: []

    Row {
        anchors.fill: parent

        Repeater {
            model: windowCompact.screens
            delegate: Rectangle {
                height: windowCompact.height
                width: windowCompact.width / windowCompact.screens.length
                color: "transparent"
                Repeater {
                    model: windowCompact.layoutOrdered.filter(t => t._screen === modelData)
                    delegate: Tile {
                        x: modelData.relativeGeometry.x * parent.width
                        y: modelData.relativeGeometry.y * parent.height
                        width: modelData.relativeGeometry.width * parent.width
                        height: modelData.relativeGeometry.height * parent.height
                        colorBorder: theme.tileBorder
                        colorFocus: theme.tileFocus
                        colorDefault: theme.tileBackground
                        radius: theme.radius
                        padding: modelData.padding
                        active: index === windowCompact.tileActived
                    }
                }
            }
        }
    }
}
