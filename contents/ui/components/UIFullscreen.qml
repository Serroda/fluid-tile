import QtQuick

Rectangle {
    id: windowFullscreen
    property int tileActived: -1
    property var theme: ({})
    property var layoutOrdered: []

    //Tile layout
    Repeater {
        model: windowFullscreen.layoutOrdered
        delegate: Tile {
            x: modelData.absoluteGeometry.x
            y: modelData.absoluteGeometry.y
            width: modelData.absoluteGeometry.width
            height: modelData.absoluteGeometry.height
            indexLayout: index
            active: index === windowFullscreen.tileActived
            colorBorder: theme.tileBorder
            colorFocus: theme.tileFocus
            colorDefault: theme.tileBackground
            radius: theme.radius
            padding: modelData.padding
        }
    }
}
