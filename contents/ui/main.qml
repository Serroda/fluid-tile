import QtQuick
import org.kde.kwin
import "./components"
import "../code/main.mjs" as Logic

Window {
    id: root
    width: Workspace.virtualScreenSize.width
    height: Workspace.virtualScreenSize.height
    color: "#AA000000"
    flags: Qt.FramelessWindowHint | Qt.WindowTransparentForInput | Qt.WindowStaysOnTopHint | Qt.BypassWindowManagerHint | Qt.Dialog
    visible: false

    property var config: ({})
    property var engine: ({})
    property var layoutOrdered: []
    property int tileActived: -1

    Timer {
        id: timerRemoveDesktop
        interval: root.config.desktopRemoveDelay
        repeat: false
        running: false
        onTriggered: {
            root.engine.onTimerRemoveDesktopFinished();
        }
    }
    
    Timer {
        id: timerExtendDesktop
        interval: root.config.windowsExtendTileChangedDelay
        repeat: false
        running: false
        onTriggered: {
            root.engine.onTimerExtendDesktopFinished();
        }
    }
    
    // Load user config
    function startEngine() {
        config = {
            appsBlocklist: KWin.readConfig("AppsBlocklist", "wl-paste,wl-copy,org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter"),
            tilesPriority: KWin.readConfig("TilesPriority", "Width,Height,Top,Left,Right,Bottom").split(","),
            maximizeExtend: KWin.readConfig("MaximizeExtend", true),
            windowsOrderOpen: KWin.readConfig("WindowsOrderOpen", false),
            windowsOrderClose: KWin.readConfig("WindowsOrderClose", false),
            windowsExtendTileChangedDelay: KWin.readConfig("WindowsExtendTileChangedDelay", 0),
            desktopAdd: KWin.readConfig("DesktopAdd", true),
            desktopRemove: KWin.readConfig("DesktopRemove", false),
            desktopRemoveMin: KWin.readConfig("DesktopRemoveMin", 1),
            desktopRemoveDelay: KWin.readConfig("DesktopRemoveDelay", 300),
            modalsIgnore: KWin.readConfig("ModalsIgnore", true),
            layoutDefault: KWin.readConfig("LayoutDefault", 2),
            UIWindowCursor:  KWin.readConfig("UIWindowCursor", false),
        };

        try {
            const layoutCustom = KWin.readConfig("LayoutCustom", "");
            config.layoutCustom = layoutCustom ? JSON.parse(layoutCustom) : undefined;
        } catch (error) {
            console.log("LayoutCustom variable error: " + error);
        }

        engine = new Logic.Engine(Workspace, config, {root,timerExtendDesktop, timerRemoveDesktop});
    }


    Connections {
        target: Workspace

        function onWindowAdded(client) {
            root.engine.setSignalsToWindow(client);
            root.engine.onWindowAdded(client);
        }

        function onWindowRemoved(client) {
            root.engine.onWindowRemoved(client);
        }

        function onCurrentDesktopChanged() {
            root.engine.onCurrentDesktopChanged();
        }
    }

    Component.onCompleted: {
        startEngine();
        engine.setWindowsSignals();
        engine.setTilesSignals();
    }

    //Tile layout
    Repeater {
        model: root.layoutOrdered
        delegate: Tile {
            x: modelData.absoluteGeometry.x
            y: modelData.absoluteGeometry.y
            width: modelData.absoluteGeometry.width
            height: modelData.absoluteGeometry.height
            padding: modelData.padding
            indexLayout: index
            active: index === root.tileActived
        }
    }
}
