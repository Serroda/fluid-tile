import QtQuick
import org.kde.kwin
import "./components"
import "../code/util.js" as Util

Window {
    id: root
    width: Workspace.virtualScreenSize.width
    height: Workspace.virtualScreenSize.height
    visible: false
    color: "#AA000000"
    flags: Qt.FramelessWindowHint | Qt.WindowTransparentForInput | Qt.WindowStaysOnTopHint | Qt.BypassWindowManagerHint | Qt.Dialog

    property var config: ({})
    property var removeDesktopInfo: ({})
    property var layoutOrdered: []
    property int tileActived: -1
    property var windowGeometryOnMove: ({})

    // Load user config
    function loadConfig() {
        config = {
            appsBlocklist: KWin.readConfig("AppsBlocklist", "wl-paste,wl-copy,org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter"),
            tilesPriority: KWin.readConfig("TilesPriority", "Width,Height,Top,Left,Right,Bottom").split(","),
            maximizeClose: KWin.readConfig("MaximizeClose", true),
            maximizeOpen: KWin.readConfig("MaximizeOpen", true),
            windowsOrderClose: KWin.readConfig("WindowsOrderClose", true),
            desktopAdd: KWin.readConfig("DesktopAdd", true),
            desktopRemove: KWin.readConfig("DesktopRemove", false),
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
    }

    //Prepare for set tile layout
    function setLayout(desktop, layout) {
        for (const screen of Workspace.screens) {
            const tileRoot = Workspace.rootTile(screen, desktop);
            Util.deleteTiles(tileRoot.tiles);
            const result = Util.setTiles(tileRoot.tiles[0] ?? tileRoot, layout);

            if (result === false) {
                console.log("Error on setLayout");
            }
        }
    }

    //Get tiles from the screen and virtual desktop
    function getOrderedTiles(desktop, screen) {
        const tileRoot = Workspace.rootTile(screen, desktop);
        return Util.orderTiles(tileRoot.tiles.length !== 0 ? tileRoot.tiles : [tileRoot], config.tilesPriority);
    }

    // Get all windows from the virtual desktop except the given window
    function getWindows(windowMain, desktop, screen) {
        const windows = [];

        for (const windowItem of Workspace.stackingOrder) {
            if (windowItem !== windowMain && windowItem.output === screen && windowItem.desktops.includes(desktop) === true && Util.checkBlocklist(windowItem, config.appsBlocklist, config.modalsIgnore) === false) {
                windows.push(windowItem);
            }
        }

        return windows;
    }

    // Set window tiles
    // mode: 0 => addWindow
    // mode: 1 => removeWindow
    function setWindowsTiles(windowMain, desktops, screens, maximize, mode) {
        for (const itemDesktop of desktops) {
            for (const itemScreen of screens) {
                const windowsOther = getWindows(windowMain, itemDesktop, itemScreen);
                const tilesOrdered = getOrderedTiles(itemDesktop, itemScreen);

                if (mode === 1 && config.windowsOrderClose === false && windowsOther.length > 1) {
                    return true;
                }

                if (mode === 0) {
                    //Set tile if the custom mosaic has space
                    if (windowsOther.length + 1 <= tilesOrdered.length) {
                        for (let x = 0; x < windowsOther.length; x++) {
                            windowsOther[x].desktops = [itemDesktop];
                            windowsOther[x].setMaximize(false, false);
                            tilesOrdered[x + 1].manage(windowsOther[x]);
                        }

                        Workspace.currentDesktop = itemDesktop;
                        windowMain.desktops = [itemDesktop];
                        tilesOrdered[0].manage(windowMain);

                        if (maximize === true && windowsOther.length === 0) {
                            windowMain.setMaximize(true, true);
                        } else {
                            windowMain.setMaximize(false, false);
                        }

                        return false;
                    }
                } else if (mode === 1 && windowsOther.length !== 0) {
                    for (let x = 0; x < windowsOther.length; x++) {
                        if (maximize === true && windowsOther.length === 1) {
                            windowsOther[x].setMaximize(true, true);
                        } else {
                            windowsOther[x].setMaximize(false, false);
                            tilesOrdered[x].manage(windowsOther[x]);
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    //Trigger when a window is added to the desktop
    function onWindowAdded(windowNew) {
        if (Util.checkBlocklist(windowNew, config.appsBlocklist, config.modalsIgnore) === true) {
            return;
        }

        const continueProcess = setWindowsTiles(windowNew, Workspace.desktops, Workspace.screens, config.maximizeOpen, 0);

        if (config.desktopAdd === true && continueProcess === true) {
            Workspace.createDesktop(Workspace.desktops.length, "");
            Workspace.currentDesktop = Workspace.desktops[Workspace.desktops.length - 1];
            windowNew.desktops = [Workspace.currentDesktop];

            if (config.maximizeOpen === true) {
                windowNew.setMaximize(true, true);
            }

            let layout = Util.getDefaultLayouts(config.layoutDefault - 1);

            if (config.layoutCustom !== undefined) {
                layout = config.layoutCustom;
            }

            setLayout(Workspace.currentDesktop, layout);

            if (config.maximizeOpen === false) {
                const tilesOrdered = getTilesFromActualDesktop();

                windowNew.setMaximize(false, false);
                tilesOrdered[0].manage(windowNew);
            }
        }
    }

    //Trigger when a window is remove to the desktop
    function onWindowRemoved(windowClosed) {
        if (Util.checkBlocklist(windowClosed, config.appsBlocklist, config.modalsIgnore) === true) {
            return;
        }

        const continueProcess = setWindowsTiles(windowClosed, windowClosed.desktops, [windowClosed.output], config.maximizeClose, 1);

        if (continueProcess === false || config.desktopRemove === false) {
            return;
        }

        removeDesktopInfo.desktopsId = windowClosed.desktops.map(d => d.id);
        removeDesktopInfo.windowClosed = windowClosed;
        timerRemoveDesktop.start();
    }

    Timer {
        id: timerRemoveDesktop
        interval: root.config.desktopRemoveDelay
        repeat: false
        running: false
        onTriggered: {
            //Case: Applications that open a window and, when an action is performed,
            //close the window and open another window (Chrome profile selector).
            //This timer avoid crash wayland

            const desktopsRemove = [];

            desktopLoop: for (const desktopItem of Workspace.desktops.filter(d => root.removeDesktopInfo.desktopsId.includes(d.id))) {
                for (const screenItem of Workspace.screens) {
                    const windowsOtherSpecialCases = root.getWindows(root.removeDesktopInfo.windowClosed, desktopItem, screenItem);

                    if (windowsOtherSpecialCases.length !== 0) {
                        continue desktopLoop;
                    }
                }

                desktopsRemove.push(desktopItem);
            }

            for (const desktop of desktopsRemove) {
                Workspace.removeDesktop(desktop);
            }

            root.removeDesktopInfo = {};
        }
    }

    //Get all tiles from the actual desktop with all screens
    function getTilesFromActualDesktop() {
        let tiles = [];
        for (const screen of Workspace.screens) {
            tiles = tiles.concat(getOrderedTiles(Workspace.currentDesktop, screen));
        }
        return tiles;
    }

    //Windows triggers
    function setWindowsSignals() {
        for (const windowItem of Workspace.stackingOrder) {
            if (Util.checkBlocklist(windowItem, config.appsBlocklist, config.modalsIgnore) === false) {
                windowItem.interactiveMoveResizeStarted.connect(onUserMoveStart);
                windowItem.interactiveMoveResizeStepped.connect(onUserMoveStepped);
                windowItem.interactiveMoveResizeFinished.connect(() => {
                    onUserMoveFinished(windowItem);
                });
            }
        }
    }

    //Reset UI
    function resetLayout() {
        layoutOrdered = [];
        layoutOrdered = getTilesFromActualDesktop();
    }

    // When a window start move with the cursor
    function onUserMoveStart() {
        resetLayout();
    }

    // When a window is moving with the cursor
    function onUserMoveStepped(windowGeometry) {
        if (windowGeometryOnMove.width === undefined && windowGeometryOnMove.height === undefined) {
            windowGeometryOnMove = {
                width: windowGeometry.width,
                height: windowGeometry.height
            };
        }

        if (windowGeometryOnMove.width !== windowGeometry.width && windowGeometryOnMove.height !== windowGeometry.height) {
            return;
        }

        visible = true;
        const cursor = Workspace.cursorPos;
        tileActived = layoutOrdered.findIndex(tile => {
            const limitX = tile.absoluteGeometry.x + tile.absoluteGeometry.width;
            const limitY = tile.absoluteGeometry.y + tile.absoluteGeometry.height;
            return tile.absoluteGeometry.x <= cursor.x && limitX >= cursor.x && tile.absoluteGeometry.y <= cursor.y && limitY >= cursor.y;
        });
    }

    //When the user release the window
    function onUserMoveFinished(windowMoved) {
        if (visible === true) {
            visible = false;
            layoutOrdered[tileActived]?.manage(windowMoved);
            windowGeometryOnMove = {};
            tileActived = -1;
        }
    }

    Connections {
        target: Workspace

        function onWindowAdded(client) {
            root.onWindowAdded(client);
            if (root.config.UIEnable === true && Util.checkBlocklist(client, root.config.appsBlocklist, root.config.modalsIgnore) === false) {
                client.interactiveMoveResizeStarted.connect(root.onUserMoveStart);
                client.interactiveMoveResizeStepped.connect(root.onUserMoveStepped);
                client.interactiveMoveResizeFinished.connect(() => {
                    root.onUserMoveFinished(client);
                });
            }
        }
        function onWindowRemoved(client) {
            root.onWindowRemoved(client);
        }
    }

    Component.onCompleted: {
        loadConfig();
        if (config.UIEnable === true) {
            setWindowsSignals();
        }
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
