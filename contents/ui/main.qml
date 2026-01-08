import QtQuick
import org.kde.kwin
import "./components"
import "../code/main.mjs" as Engine

Window {
    id: root
    width: Workspace.virtualScreenSize.width
    height: Workspace.virtualScreenSize.height
    color: "#AA000000"
    flags: Qt.FramelessWindowHint | Qt.WindowTransparentForInput | Qt.WindowStaysOnTopHint | Qt.BypassWindowManagerHint | Qt.Dialog
    visible: false

    property var config: ({})
    property var engine: ({})
    property var removeDesktopInfo: ({})
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
    function loadConfig() {
        config = {
            appsBlocklist: KWin.readConfig("AppsBlocklist", "wl-paste,wl-copy,org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter"),
            tilesPriority: KWin.readConfig("TilesPriority", "Width,Height,Top,Left,Right,Bottom").split(","),
            maximizeClose: KWin.readConfig("MaximizeClose", true),
            maximizeOpen: KWin.readConfig("MaximizeOpen", true),
            windowsOrderOpen: KWin.readConfig("WindowsOrderOpen", true),
            windowsOrderClose: KWin.readConfig("WindowsOrderClose", true),
            windowsOrderMove: KWin.readConfig("WindowsOrderMove", true),
            windowsExtendOpen: KWin.readConfig("WindowsExtendOpen", true),
            windowsExtendClose: KWin.readConfig("WindowsExtendClose", true),
            windowsExtendMove: KWin.readConfig("WindowsExtendMove", true),
            windowsExtendMinimize: KWin.readConfig("WindowsExtendMinimize", true),
            windowsExtendResize: KWin.readConfig("WindowsExtendResize", true),
            windowsExtendTileChangedDelay: KWin.readConfig("WindowsExtendTileChangedDelay", 0),
            desktopAdd: KWin.readConfig("DesktopAdd", true),
            desktopRemove: KWin.readConfig("DesktopRemove", false),
            desktopRemoveMin: KWin.readConfig("DesktopRemoveMin", 1),
            desktopRemoveDelay: KWin.readConfig("DesktopRemoveDelay", 300),
            modalsIgnore: KWin.readConfig("ModalsIgnore", true),
            layoutDefault: KWin.readConfig("LayoutDefault", 2),
            UIEnable: KWin.readConfig("UIEnable", true),
            UIWindowCursor:  KWin.readConfig("UIWindowCursor", false),
        };

        try {
            const layoutCustom = KWin.readConfig("LayoutCustom", "");
            config.layoutCustom = layoutCustom ? JSON.parse(layoutCustom) : undefined;
        } catch (error) {
            console.log("LayoutCustom variable error: " + error);
        }

        engine = Engine.useTriggers(Workspace, config, root, timerExtendDesktop);
    }


    Connections {
        target: Workspace

        function onWindowAdded(client) {
            root.engine.onWindowAdded(client);
            root.engine.setSignalsToWindow(client);
        }

        function onWindowRemoved(client) {
            const deleteDesktop = root.engine.onWindowRemoved(client);
            if (deleteDesktop === false) {
                return;
            }
            root.removeDesktopInfo.desktopsId = client.desktops.map(d => d.id);
            root.removeDesktopInfo.windowClosed = client;
            timerRemoveDesktop.start();
        }

        function onCurrentDesktopChanged() {
            root.engine.onCurrentDesktopChanged();
        }
    }

    Component.onCompleted: {
        loadConfig();
        engine.setWindowsSignals();
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
