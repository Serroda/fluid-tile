import QtQuick

Rectangle {
    id: tile
    color: "transparent"
    property int padding: 0
    property int indexLayout: 0
    property bool active: false

    Rectangle {
        anchors.fill: tile
        anchors.margins: tile.padding
        color: tile.active ? "#AAFFFFFF" : "#30FFFFFF"
        radius: 8
        border.width: 2
        border.color: tile.active ? "#DDFFFFFF" : "#BBFFFFFF"

        Behavior on color {
            ColorAnimation {
                duration: 200
            }
        }

        Behavior on border.color {
            ColorAnimation {
                duration: 200
            }
        }

        Rectangle {
            anchors.centerIn: parent
            radius: 8
            width: 50
            height: 50
            color: "#ffffff"
            Text {
                anchors.centerIn: parent
                text: tile.indexLayout + 1
                color: "#000000"
                font.pixelSize: 32
                font.bold: true
            }
        }
    }
}
