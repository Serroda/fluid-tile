import { Blocklist } from "./blocklist.mjs";
import { Queue } from "./queue.mjs";
import { Shortcuts } from "./shortcuts.mjs";
import { Tiles } from "./tiles.mjs";
import { UI } from "./ui.mjs";
import { Userspace } from "./userspace.mjs";
import { Windows } from "./windows.mjs";

export class Engine {
  constructor(
    workspace,
    config,
    {
      root,
      timerExtendDesktop,
      timerRemoveDesktop,
      timerDesktopChanged,
      timerResetAll,
    },
  ) {
    this.state = {
      desktopsExtend: new Queue(),
      removeDesktopInfo: {},
    };
    this.workspace = workspace;
    this.config = config;
    this.rootUI = root;
    this.timers = {
      extendDesktop: timerExtendDesktop,
      removeDesktop: timerRemoveDesktop,
      desktopChanged: timerDesktopChanged,
      resetAll: timerResetAll,
    };
    this.classes = {
      blocklist: new Blocklist(config),
      userspace: new Userspace(workspace),
      tiles: new Tiles(workspace, config),
    };
    this.classes.windows = new Windows(
      workspace,
      config,
      root,
      this.state,
      this.classes,
    );
    this.classes.ui = new UI(workspace, config, root, this.classes);
    this.classes.shortcuts = new Shortcuts(
      workspace,
      config,
      root,
      this.classes,
      timerResetAll,
    );
  }

  //Trigger when a window is added to the desktop
  onWindowAdded(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    const continueProcess = this.classes.windows.setTilesOnAdd(window);

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
      const tilesOrdered = this.classes.tiles.getTilesCurrentDesktop();

      if (this.config.maximizeExtend === true) {
        window.setMaximize(true, true);
      } else {
        window.setMaximize(false, false);
        window._avoidTileChangedTrigger = false;
        tilesOrdered[0].manage(window);
      }

      window._tileShadow = tilesOrdered[0];
    }
  }

  //Trigger when a window is remove to the desktop
  onWindowRemoved(window) {
    if (this.classes.blocklist.check(window) === true) {
      return false;
    }

    const continueProcess = this.classes.windows.setTilesOnRemove(window);

    if (continueProcess === false) {
      this.classes.windows.focus();
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

      this.timers.removeDesktop.start();
    }
  }

  //Set signals to all Windows
  setWindowsSignals() {
    for (const windowItem of this.workspace.stackingOrder) {
      this.setSignalsToWindow(windowItem);
    }
  }

  //Set signals to window
  setSignalsToWindow(window) {
    if (this.classes.blocklist.check(window) === true) {
      return;
    }

    window._signals = {
      maximizedAboutToChange: this.onMaximizeAboutToChanged.bind(this, window),
      minimizedChanged: this.onMinimizedChanged.bind(this, window),
      interactiveMoveResizeStarted: this.classes.ui.onUserMoveStart.bind(
        this.classes.ui,
        window,
      ),
      interactiveMoveResizeStepped: this.classes.ui.onUserMoveStepped.bind(
        this.classes.ui,
        window,
      ),
      interactiveMoveResizeFinished: this.classes.ui.onUserMoveFinished.bind(
        this.classes.ui,
        window,
      ),
    };

    for (const key in window._signals) {
      window[key].connect(window._signals[key]);
    }
  }

  //When a window tile is changed, exchange windows and extend windows
  onWindowAddedToTile(tile, window) {
    //Trigger when a window is maximized but not minimized
    //when a window exchange
    console.log("window added to tile", window._avoidTileChangedTrigger);

    if (
      this.rootUI.visible === true ||
      window._avoidTileChangedTrigger === true ||
      window._tileShadow === undefined
    ) {
      window._avoidTileChangedTrigger =
        window._avoidTileChangedTrigger === true
          ? false
          : window._avoidTileChangedTrigger;

      console.log("avoid", window._avoidTileChangedTrigger);

      return;
    }

    const windowsOther = this.classes.windows
      .getAll(window)
      .filter(
        (w) =>
          w.minimized === false && (w.tile === tile || w._tileShadow === tile),
      );

    if (windowsOther.length > 0) {
      this.classes.tiles.exchangeTiles(windowsOther, window._tileShadow);
    }

    if (this.workspace.currentDesktop !== window._tileShadow._desktop) {
      this.state.desktopsExtend.add(window._tileShadow.desktop);
    }

    //Start delay only when you have to exchange in another screen
    if (window._tileShadow._screen !== this.workspace.activeScreen) {
      this.timers.extendDesktop.interval =
        this.config.windowsExtendTileChangedDelay;
      this.timers.extendDesktop.start();
    } else if (
      this.classes.tiles.getTilesCurrentDesktop().length >
      windowsOther.length + 1 ||
      window._maximized === false
    ) {
      //Start timer without delay, if you dont execute `extendWindows` inside
      //QTimer, `extendWindows` doesnt get the correct position of the windows
      this.timers.extendDesktop.interval = 0;
      this.timers.extendDesktop.start();
    }

    window._tileShadow = tile;
  }

  //When window is not maximized, set a previous tile
  onMaximizeAboutToChanged(window, mode) {
    window._maximized = mode === 3;

    //When a window is maximized window.tile is always null
    console.log("maximize change", mode, window);

    if (
      this.rootUI.visible === true ||
      window._maximized === true ||
      window._avoidMaximizeTrigger === true ||
      window._tileShadow === undefined ||
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
    if (
      window.tile !== window._tileShadow &&
      window._avoidManageTileMaximize !== true
    ) {
      window._avoidTileChangedTrigger = false;
      window._avoidMaximizeExtend = true;
      window._avoidManageTileMaximize = true;
      window._tileShadow.manage(window);
    } else {
      window._avoidManageTileMaximize = false;
    }
  }

  //When a window is minimized, extend windows
  onMinimizedChanged(window) {
    if (window.desktops.includes(this.workspace.currentDesktop) === false) {
      this.state.desktopsExtend.add(window.desktops[0]);
      return;
    }

    window._avoidMaximizeTrigger = true;
    window.setMaximize(false, false);
    this.classes.windows.extendCurrentDesktop(true);
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
        const windowsOtherSpecialCases = this.classes.windows.getAll(
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
    this.classes.windows.extendCurrentDesktop();
  }

  //Extend windows when timer finish
  onTimerExtendDesktopFinished() {
    this.classes.windows.extendCurrentDesktop(true);
  }

  //Focus window when timer finish
  onTimerDesktopChangedFinished() {
    const moved = this.classes.windows.movedToAnotherDesktopShortcut();

    if (moved === false) {
      this.classes.windows.focus();
    }

    if (
      this.state.desktopsExtend.exists(this.workspace.currentDesktop) === true
    ) {
      this.classes.windows.extendCurrentDesktop(true);
      this.state.desktopsExtend.remove(this.workspace.currentDesktop);
    }
  }

  //Extend windows when timer finish
  onTimerResetAllFinished() {
    this.classes.windows.resetAll();
    this.setTilesSignals();
    this.classes.windows.reconnectSignals();
  }

  // Focus window when a current desktop is changed
  onCurrentDesktopChanged() {
    console.log("desktop changed");
    this.classes.ui.resetLayout();
    this.setTilesSignals();
    this.timers.desktopChanged.start();
  }

  //Set signal to tiles
  setTilesSignals() {
    const rootTile = this.classes.tiles.getRootTile();

    if (rootTile === null) {
      return;
    }

    if (rootTile._signals === undefined) {
      rootTile._signals = {
        childTilesChanged: this.onChildTilesChanged.bind(this),
        windowAdded: this.onWindowAddedToTile.bind(this, rootTile),
      };

      for (const key in rootTile._signals) {
        rootTile[key].connect(rootTile._signals[key]);
      }
    }

    const tiles = this.classes.tiles.getTilesCurrentDesktop();

    for (const tile of tiles) {
      if (tile._signals !== undefined) {
        continue;
      }

      tile._signals = {
        childTilesChanged: this.onChildTilesChanged.bind(this),
        windowAdded: this.onWindowAddedToTile.bind(this, tile),
      };

      for (const key in tile._signals) {
        tile[key].connect(tile._signals[key]);
      }
    }
  }

  onChildTilesChanged() {
    console.log("child changed");
    this.setTilesSignals();
    this.classes.windows.extendCurrentDesktop();
  }
}
