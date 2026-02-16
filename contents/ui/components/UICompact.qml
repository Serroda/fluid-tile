import QtQuick

Rectangle {
    id: windowCompact
    width: 180 * screens.length
    height: 120

    anchors.centerIn: parent
    property var screens: []
    property int tileActived: -1
    property var theme: ({})
    property var layoutOrdered: []

    Row {
        anchors.fill: parent

        Repeater {
            model: windowCompact.screens.sort((a, b) => a.geometry.x - b.geometry.x)
            delegate: Rectangle {
                id: section
                height: windowCompact.height
                width: windowCompact.width / windowCompact.screens.length
                color: "transparent"

                property var tilesScreen: windowCompact.layoutOrdered.filter(t => t._screen === modelData)

                Repeater {
                    model: tilesScreen
                    delegate: Tile {
                        id: tile
                        x: modelData.relativeGeometry.x * parent.width
                        y: modelData.relativeGeometry.y * parent.height
                        width: modelData.relativeGeometry.width * parent.width
                        height: modelData.relativeGeometry.height * parent.height
                        colorBorder: theme.tileBorder
                        colorFocus: theme.tileFocus
                        colorDefault: theme.tileBackground
                        radius: theme.radius
                        padding: modelData.padding
                        active: modelData === windowCompact.layoutOrdered[windowCompact.tileActived]
                    }
                }
            }
        }
    }
}
