import QtQuick
import org.kde.kwin

Item {
    id: shortcut
    property string name: ""
    property string text: ""
    property string sequence: ""
    property var callback: ({}) 
    
  ShortcutHandler {
    name: shortcut.name
    text: shortcut.text
    sequence: shortcut.sequence
    onActivated: {
      shortcut.callback()
    }
  }
}
