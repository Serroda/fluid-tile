import { Blocklist } from "./blocklist.mjs";
import { Tiles } from "./tiles.mjs";
import { UI } from "./ui.mjs";
import { Userspace } from "./userspace.mjs";
import { Windows } from "./windows.mjs";

export class Engine {
  constructor(
    workspace,
    config,
    rootUI,
    { timerExtendDesktop, timerRemoveDesktop },
  ) {
    this.workspace = workspace;
    this.config = config;
    this.rootUI = rootUI;
    this.timerExtendDesktop = timerExtendDesktop;
    this.timerRemoveDesktop = timerRemoveDesktop;
    this.classes = {
      blocklist: new Blocklist(this.config),
      userspace: new Userspace(this.workspace),
      tiles: new Tiles(this.workspace, this.config),
    };
    this.classes.ui = new UI(
      this.workspace,
      this.config,
      this.rootUI,
      this.classes,
    );
    this.classes.windows = new Windows(
      this.workspace,
      this.config,
      this.classes,
    );

    this.state = {
      desktopsExtend: [],
      removeDesktopInfo: {},
    };
  }

  //Trigger when a window is added to the desktop
  onWindowAdded(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    const continueProcess = this.classes.window.setWindowsTilesAdded(window);

    if (this.config.desktopAdd === true && continueProcess === true) {
      this.workspace.createDesktop(this.workspace.desktops.length, "");
      this.workspace.currentDesktop =
        this.workspace.desktops[this.workspace.desktops.length - 1];
      window.desktops = [this.workspace.currentDesktop];

      let layout = this.classes.tiles.getDefaultLayouts(
        this.config.layoutDefault - 1,
      );

      if (this.config.layoutCustom !== undefined) {
        layout = this.config.layoutCustom;
      }

      this.classes.tiles.setLayout(this.workspace.currentDesktop, layout);
      const tilesOrdered = this.classes.tiles.getTilesFromActualDesktop();

      if (this.config.maximizeExtend === true) {
        window.setMaximize(true, true);
      } else {
        window.setMaximize(false, false);
        window._avoidTileChangedTrigger = false;
        tilesOrdered[0].manage(window);
      }

      this.classes.windows.updateShadows(window, tilesOrdered[0]);
    }
  }

  //Trigger when a window is remove to the desktop
  onWindowRemoved(window) {
    if (this.classes.blocklist.check(window) === true) {
      return false;
    }

    const continueProcess = this.classes.windows.setWindowsTilesRemoved(window);

    if (continueProcess === false) {
      this.classes.windows.focusWindow();
      return;
    }

    if (
      continueProcess === true &&
      this.config.desktopRemove === true &&
      this.workspace.desktops.length > 1 &&
      this.workspace.desktops.length > this.config.desktopRemoveMin
    ) {
      this.state.removeDesktopInfo = {
        desktopsId: window.desktops.map((d) => d.id),
        window: window,
      };

      this.timerRemoveDesktop.start();
    }
  }

  //Set signals to all Windows
  setWindowsSignals() {
    for (const windowItem of this.workspace.stackingOrder) {
      setSignalsToWindow(windowItem);
    }
  }

  //Set signals to window
  setSignalsToWindow(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    window.maximizedAboutToChange.connect((mode) => {
      onMaximizeChanged(mode, window);
    });

    window.minimizedChanged.connect(() => {
      onMinimizedChanged(window);
    });

    window.interactiveMoveResizeStarted.connect(
      this.classes.UI.onUserMoveStart,
    );
    window.interactiveMoveResizeStepped.connect(
      this.classes.UI.onUserMoveStepped,
    );
    window.interactiveMoveResizeFinished.connect(() => {
      const windowMoved = this.classes.UI.onUserMoveFinished(window);
      if (windowMoved === false) {
        this.classes.windows.extendWindowsCurrentDesktop(true);
      }
    });
  }

  //When a window tile is changed, exchange windows and extend windows
  onWindowAddedToTile(tile, window) {
    //Trigger when a window is maximized but not minimized
    //when a window exchange
    console.log(
      "window added to tile",
      window._avoidTileChangedTrigger,
      window,
      tile,
    );

    if (
      this.rootUI.visible === true ||
      window._avoidTileChangedTrigger === true ||
      window._shadows === undefined
    ) {
      window._avoidTileChangedTrigger =
        window._avoidTileChangedTrigger === true
          ? false
          : window._avoidTileChangedTrigger;

      console.log("avoid", window._avoidTileChangedTrigger);

      return;
    }

    const windowsOther = this.classes.windows
      .getWindows(window)
      .filter(
        (w) =>
          w.minimized === false &&
          (w.tile === tile || w._shadows?.tile === tile),
      );

    if (windowsOther.length > 0 && this.config.windowsExchange === true) {
      this.classes.tiles.exchangeTiles(
        windowsOther,
        window._shadows.tile,
        window._shadows.desktop,
        window._shadows.screen,
      );
    }

    if (
      this.workspace.currentDesktop !== window._shadows.desktop &&
      this.state.desktopsExtend.includes(window._shadows.desktop) === false
    ) {
      this.state.desktopsExtend.push(window._shadows.desktop);
    }

    //Start delay only when you have to exchange in another screen
    if (window._shadows.screen !== this.workspace.activeScreen) {
      this.timerExtendDesktop.interval =
        this.config.windowsExtendTileChangedDelay;
      this.timerExtendDesktop.start();
    } else if (
      this.classes.tiles.getTilesFromActualDesktop().length >
      windowsOther.length + 1 ||
      window._maximized === false
    ) {
      //Start delay only when you have to exchange in another screen
      this.timerExtendDesktop.interval = 0;
      this.timerExtendDesktop.start();
    }

    console.log("update shadow tile changed");
    // Set `tileNew` to `_shadows.tile` when window is maximized for avoid
    // `windowMain.tile === null` and `windowMain._shadows.tile === oldCopyTile`
    // setting `tileNew` we get now `windowMain._shadows.tile === tileNew`

    this.windows.updateShadows(window, tile);
  }

  //When window is not maximized, set a previous tile
  onMaximizeChanged(mode, window) {
    window._maximized = mode === 3;

    //When a window is maximized window.tile is always null
    console.log("maximize change", window, mode, window._avoidMaximizeTrigger);

    if (
      window._maximized === true ||
      window._avoidMaximizeTrigger === true ||
      window._shadows === undefined ||
      window.tile !== null
    ) {
      window._avoidMaximizeTrigger =
        window._avoidMaximizeTrigger === true
          ? false
          : window._avoidMaximizeTrigger;
      console.log("avoid", window._avoidMaximizeTrigger);
      return;
    }

    //If not fullscreen
    if (window.tile !== window._shadows.tile) {
      console.log("maximize manage");
      window._avoidTileChangedTrigger = false;
      window._avoidMaximizeExtend = true;
      window._shadows.tile?.manage(window);
    }
  }

  //When a window is minimized, extend windows
  onMinimizedChanged(window) {
    if (
      window.desktops.includes(this.workspace.currentDesktop) === false &&
      this.state.desktopsExtend.includes(this.workspace.currentDesktop) ===
      false
    ) {
      this.state.desktopsExtend.push(this.workspace.currentDesktop);
      return;
    }

    window.setMaximize(false, false);
    this.classes.windows.extendWindowsCurrentDesktop(true);
  }

  onTimerRemoveDesktopFinished() {
    //Case: Applications that open a window and, when an action is performed,
    //close the window and open another window (Chrome profile selector).
    //This timer avoid crash wayland
    const desktopsRemove = [];

    desktopLoop: for (const desktopItem of this.workspace.desktops.filter((d) =>
      this.state.removeDesktopInfo.desktopsId.includes(d.id),
    )) {
      for (const screenItem of this.workspace.screens) {
        const windowsOtherSpecialCases = this.classes.windows.getWindows(
          this.state.removeDesktopInfo.window,
          desktopItem,
          screenItem,
        );

        if (windowsOtherSpecialCases.length !== 0) {
          continue desktopLoop;
        }
      }

      desktopsRemove.push(desktopItem);
    }

    for (const desktop of desktopsRemove) {
      this.workspace.removeDesktop(desktop);
    }

    this.state.removeDesktopInfo = {};
    this.classes.windows.extendWindowsCurrentDesktop();
  }

  //Extend windows when timer finish
  onTimerExtendDesktopFinished() {
    this.classes.windows.extendWindowsCurrentDesktop(true);
  }

  // Focus window when a current desktop is changed
  onCurrentDesktopChanged() {
    console.log("desktop changed");
    this.classes.UI.resetLayout();
    setTilesSignals();
    this.classes.windows.focusWindow();

    if (
      this.state.desktopsExtend.includes(this.workspace.currentDesktop) === true
    ) {
      this.classes.windows.extendWindowsCurrentDesktop(true);
      this.state.desktopsExtend.splice(
        this.state.desktopsExtend.indexOf(this.workspace.currentDesktop),
        1,
      );
    }
  }

  //Set signal to tiles
  setTilesSignals() {
    const rootTile = this.classes.tiles.getRootTile();

    if (rootTile === null) {
      return;
    }

    if (rootTile._childTilesSignalConnected !== true) {
      rootTile.childTilesChanged.connect(() => {
        console.log("rootTile change childs");
        onChildTilesChanged();
      });
      rootTile._childTilesSignalConnected = true;
    }

    const tiles = this.classes.tiles.getOrderedTiles();

    for (const tile of tiles) {
      if (tile._windowAddedSignalConnected !== true && rootTile !== tile) {
        console.log("signal added", tile);
        tile._windowAddedSignalConnected = true;
        tile.windowAdded.connect(onWindowAddedToTile.bind(null, tile));
        tile.childTilesChanged.connect(() => {
          console.log("tile change childs");
          onChildTilesChanged();
        });
      }
    }
  }

  onChildTilesChanged() {
    setTilesSignals();
    this.classes.windows.extendWindowsCurrentDesktop();
  }
}
