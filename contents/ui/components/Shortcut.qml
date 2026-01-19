import QtQuick
import org.kde.kwin

Item {
    id: shortcut
    property string title: ""
    property string text: ""
    property string keys: ""
    property var trigger: ({}) 
    
  ShortcutHandler {
    name: shortcut.title
    text: shortcut.text
    sequence: shortcut.keys
    onActivated: {
      shortcut.trigger()
    }
  }
}
