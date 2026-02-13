import QtQuick
import org.kde.kwin
import "./components"
import "../code/main.mjs" as Logic

Window {
    id: root
    property var config: ({})
    property var engine: ({})
    property var shortcuts: []
    property var layoutOrdered: []
    property int tileActived: -1

    flags: Qt.FramelessWindowHint | Qt.WindowTransparentForInput | Qt.WindowStaysOnTopHint | Qt.BypassWindowManagerHint
    width: Workspace.virtualScreenSize.width
    height: Workspace.virtualScreenSize.height
    visible: false
    color: "transparent"

    Timer {
        id: timerRemoveDesktop
        interval: root.config.desktopRemoveDelay
        repeat: false
        running: false
        property var removeInfo: ({})
        onTriggered: {
            root.engine.onTimerRemoveDesktopFinished(removeInfo);
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

    Timer {
        id: timerCurrentDesktopChanged
        interval: 0
        repeat: false
        running: false
        onTriggered: {
            root.engine.onTimerCurrentDesktopChangedFinished();
        }
    }

    Timer {
        id: timerResetAll
        interval: 0
        repeat: false
        running: false
        property bool screenAll: false
        onTriggered: {
            root.engine.onTimerResetAllFinished(screenAll);
        }
    }

    Timer {
        id: timerHideUI
        interval: 1000
        repeat: false
        running: false
        property int ui: -1
        property bool rootHide: true
        onTriggered: {
            root.engine.onTimerHideUIFinished(ui, rootHide);
        }
    }

    // Load user config
    function startEngine() {
        config = {
            appsBlocklist: KWin.readConfig("AppsBlocklist", "org.kde.xwaylandvideobridge,wl-paste,wl-copy,org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter"),
            tilesPriority: KWin.readConfig("TilesPriority", "Width,Height,Top,Left,Right,Bottom").split(","),
            maximizeExtend: KWin.readConfig("MaximizeExtend", true),
            windowsOrderOpen: KWin.readConfig("WindowsOrderOpen", false),
            windowsOrderClose: KWin.readConfig("WindowsOrderClose", false),
            windowsExtendTileChangedDelay: KWin.readConfig("WindowsExtendTileChangedDelay", 300),
            desktopAdd: KWin.readConfig("DesktopAdd", true),
            desktopRemove: KWin.readConfig("DesktopRemove", false),
            desktopRemoveMin: KWin.readConfig("DesktopRemoveMin", 1),
            desktopRemoveDelay: KWin.readConfig("DesktopRemoveDelay", 300),
            desktopExtra: KWin.readConfig("DesktopExtra", true),
            modalsIgnore: KWin.readConfig("ModalsIgnore", true),
            layoutDefault: KWin.readConfig("LayoutDefault", 2),
            UIWindowCursor: KWin.readConfig("UIWindowCursor", false)
        };

        try {
            const layoutCustom = KWin.readConfig("LayoutCustom", "");
            config.layoutCustom = layoutCustom ? JSON.parse(layoutCustom) : undefined;
        } catch (error) {
            console.log("LayoutCustom variable error: " + error);
        }

        engine = new Logic.Engine(Workspace, config, {
            root,
            timerExtendDesktop,
            timerRemoveDesktop,
            timerCurrentDesktopChanged,
            timerResetAll,
            timerHideUI,
            windowFullscreen,
            windowPopup
        });
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

        function onDesktopsChanged() {
            root.engine.onDesktopsChanged();
        }
    }

    Component.onCompleted: {
        startEngine();
        engine.setWindowsSignals();
        engine.setTilesSignals();
    }

    Theme {
        id: theme
    }

    Repeater {
        model: root.shortcuts
        delegate: Shortcut {
            name: modelData.name
            text: modelData.text
            sequence: modelData.sequence
            callback: modelData.callback
        }
    }

    UIFullscreen {
        id: windowFullscreen
        width: root.width
        height: root.height
        color: theme.windowFullscreenBackground
        visible: false
        tileActived: root.tileActived
        theme: theme
        layoutOrdered: root.layoutOrdered
    }

    UIPopup {
        id: windowPopup
        visible: false
        color: theme.windowBackground
        theme: theme
        radius: theme.radius
        layoutOrdered: root.layoutOrdered
    }
}
