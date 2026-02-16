import QtQuick

Item {
    id: tile
    property int indexLayout: -1
    property bool active: false
    property color colorFocus: "transparent"
    property color colorDefault: "transparent"
    property color colorBorder: "transparent"
    property int radius: 0
    property int padding: 0

    Rectangle {
        color: tile.active ? tile.colorFocus : tile.colorDefault
        border.color: tile.colorBorder
        radius: tile.radius

        anchors {
            fill: tile
            topMargin: tile.y === 0 ? tile.padding : 0
            leftMargin: tile.x === 0 ? tile.padding : 0
            rightMargin: tile.padding
            bottomMargin: tile.padding
        }

        Behavior on color {
            ColorAnimation {
                duration: 120
            }
        }

        Rectangle {
            visible: tile.indexLayout > -1
            anchors.centerIn: parent
            radius: tile.radius
            width: 50
            height: 50
            color: "#ffffff"
            Text {
                anchors.centerIn: parent
                text: tile.indexLayout + 1
                color: "#000000"
                font.pixelSize: 30
                font.bold: true
            }
        }
    }
}
