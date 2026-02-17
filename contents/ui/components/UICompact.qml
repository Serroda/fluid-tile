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
    property int sizePerSection: (windowCompact.width / windowCompact.screens.length)

    //TODO: Seperation between screens
    Repeater {
        model: windowCompact.dataLayout
        delegate: Tile {
            id: tile
            x: {
                return windowCompact.screens.indexOf(modelData._screen) * windowCompact.sizePerSection + modelData.relativeGeometry.x * windowCompact.sizePerSection;
            }
            y: modelData.relativeGeometry.y * parent.height
            width: modelData.relativeGeometry.width * windowCompact.sizePerSection
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
