import QtQuick

Rectangle {
    id: windowCompact
    width: 180 * screens.length
    height: 120

    anchors.centerIn: parent
    property var theme: ({})
    property var tileActive: undefined
    property var dataLayout: []
    property var screens: []
    property var spacingRow: 8
    property int sizePerSection: (windowCompact.width / windowCompact.screens.length) - (windowCompact.screens.length - 1) * (spacingRow / 2)

    Row {
        anchors.centerIn: parent
        height: parent.height
        width: parent.width
        spacing: windowCompact.spacingRow

        Repeater {
            model: windowCompact.screens
            delegate: Rectangle {
                id: section
                color: "transparent"
                height: parent.height
                width: windowCompact.sizePerSection
                property var tilesPerScreen: windowCompact.dataLayout.filter(t => t._screen === modelData)

                Repeater {
                    model: section.tilesPerScreen
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
                        active: modelData === windowCompact.tileActive
                    }
                }
            }
        }
    }
}
