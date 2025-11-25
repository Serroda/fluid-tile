import QtQuick
import org.kde.kwin
import "./components"
import "../code/windows.mjs" as ApiWindow

Window {
    id: root
    width: Workspace.virtualScreenSize.width
    height: Workspace.virtualScreenSize.height
    color: "#AA000000"
    flags: Qt.FramelessWindowHint | Qt.WindowTransparentForInput | Qt.WindowStaysOnTopHint | Qt.BypassWindowManagerHint | Qt.Dialog
    visible: false

    property var config: ({})
    property var apiWindow: ({})
    property var removeDesktopInfo: ({})
    property var layoutOrdered: []
    property int tileActived: -1

    // Load user config
    function loadConfig() {
        config = {
            appsBlocklist: KWin.readConfig("AppsBlocklist", "wl-paste,wl-copy,org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter"),
            tilesPriority: KWin.readConfig("TilesPriority", "Width,Height,Top,Left,Right,Bottom").split(","),
            maximizeClose: KWin.readConfig("MaximizeClose", true),
            maximizeOpen: KWin.readConfig("MaximizeOpen", true),
            windowsOrderClose: KWin.readConfig("WindowsOrderClose", true),
            windowsOrderMove: KWin.readConfig("WindowsOrderMove", true),
            windowsExtend: KWin.readConfig("WindowsExtend", true),
            desktopAdd: KWin.readConfig("DesktopAdd", true),
            desktopRemove: KWin.readConfig("DesktopRemove", false),
            desktopRemoveMin: KWin.readConfig("DesktopRemoveMin", 1),
            desktopRemoveDelay: KWin.readConfig("DesktopRemoveDelay", 300),
            modalsIgnore: KWin.readConfig("ModalsIgnore", true),
            layoutDefault: KWin.readConfig("LayoutDefault", 2),
            UIEnable: KWin.readConfig("UIEnable", true)
        };

        try {
            const layoutCustom = KWin.readConfig("LayoutCustom", "");
            config.layoutCustom = layoutCustom ? JSON.parse(layoutCustom) : undefined;
        } catch (error) {
            console.log("LayoutCustom variable error: " + error);
        }

        apiWindow = ApiWindow.useWindows(Workspace, config, root);
    }

    Timer {
        id: timerRemoveDesktop
        interval: root.config.desktopRemoveDelay
        repeat: false
        running: false
        onTriggered: {
            root.apiWindow.onTimerFinished();
        }
    }

    Connections {
        target: Workspace

        function onWindowAdded(client) {
            root.apiWindow.onWindowAdded(client);
            root.apiWindow.setSignalsToWindow(client);
        }

        function onWindowRemoved(client) {
            const deleteDesktop = root.apiWindow.onWindowRemoved(client);
            if (deleteDesktop === false) {
                return;
            }
            root.removeDesktopInfo.desktopsId = client.desktops.map(d => d.id);
            root.removeDesktopInfo.windowClosed = client;
            timerRemoveDesktop.start();
        }
    }

    Component.onCompleted: {
        loadConfig();
        apiWindow.setWindowsSignals();
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
