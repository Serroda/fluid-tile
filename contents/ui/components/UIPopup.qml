import QtQuick

Rectangle {
    id: popup
    width: 180
    height: 120
    anchors.centerIn: parent

    property var theme: ({})
    property var layoutOrdered: []

    Repeater {
        model: popup.layoutOrdered
        delegate: Tile {
            x: modelData.relativeGeometry.x * parent.width
            y: modelData.relativeGeometry.y * parent.height
            width: modelData.relativeGeometry.width * parent.width
            height: modelData.relativeGeometry.height * parent.height
            colorBorder: theme.tileBorder
            colorDefault: theme.tileFocus
            radius: theme.radius
            padding: modelData.padding
        }
    }
}
