import QtQuick

Rectangle {
    id: windowFullscreen
    property var theme: ({})
    property var tileActive: undefined
    property var dataLayout: []

    //Tile layout
    Repeater {
        model: windowFullscreen.dataLayout
        delegate: Tile {
            x: modelData.absoluteGeometry.x
            y: modelData.absoluteGeometry.y
            width: modelData.absoluteGeometry.width
            height: modelData.absoluteGeometry.height
            indexLayout: index
            active: modelData === windowFullscreen.tileActive
            colorBorder: theme.tileBorder
            colorFocus: theme.tileFocus
            colorDefault: theme.tileBackground
            radius: theme.radius
            padding: modelData.padding
        }
    }
}
