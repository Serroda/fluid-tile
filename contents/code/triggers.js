//Delete Virtual Desktop if is empty or maximize the last window
function onCloseWindow(windowClosed) {
  const appsBlocklist = readConfig(
    "AppsBlocklist",
    APPS_BLOCKLIST,
  ).toLowerCase();

  const modalsIgnore = readConfig("ModalsIgnore", MODALS_IGNORE);

  if (checkBlocklist(windowClosed, appsBlocklist, modalsIgnore) === true) {
    return;
  }

  const maximizeClose = readConfig("CloseMaximize", MAXIMIZE_CLOSE);
  const windowsOrderClose = readConfig(
    "windowsOrderClose",
    WINDOWS_ORDER_CLOSE,
  );

  const continueProcess = setWindowsTiles(
    windowClosed,
    windowClosed.desktops,
    windowClosed.output,
    appsBlocklist,
    modalsIgnore,
    maximizeClose,
    1,
    windowsOrderClose,
  );

  if (continueProcess === false) {
    return;
  }

  const desktopRemove = readConfig("DesktopRemove", DESKTOP_REMOVE);

  if (desktopRemove === false) {
    return;
  }

  const desktopRemoveDelay = readConfig(
    "DesktopRemoveDelay",
    DESKTOP_REMOVE_DELAY,
  );

  //Case: Applications that open a window and, when an action is performed,
  //close the window and open another window (Chrome profile selector).
  //This timer avoid crash wayland

  const timer = new QTimer();
  timer.singleShot = true;
  timer.interval = desktopRemoveDelay;
  timer.timeout.connect(function () {
    for (const desktopItem of windowClosed.desktops) {
      const windowsOtherSpecialCases = getWindows(
        windowClosed,
        desktopItem,
        windowClosed.output,
        appsBlocklist,
        modalsIgnore,
      );
      if (windowsOtherSpecialCases.length === 0) {
        workspace.removeDesktop(desktopItem);
      }
    }
  });

  timer.start();
}

//Set tile to the new Window
function onOpenWindow(windowNew) {
  const appsBlocklist = readConfig(
    "AppsBlpcklist",
    APPS_BLOCKLIST,
  ).toLowerCase();
  const modalsIgnore = readConfig("ModalsIgnore", MODALS_IGNORE);

  if (checkBlocklist(windowNew, appsBlocklist, modalsIgnore) === true) {
    return;
  }

  const maximizeOpen = readConfig("MaximizeOpen", MAXIMIZE_OPEN);
  const desktopAdd = readConfig("DesktopAdd", DESKTOP_ADD);

  const continueProcess = setWindowsTiles(
    windowNew,
    workspace.desktops,
    workspace.screens,
    appsBlocklist,
    modalsIgnore,
    maximizeOpen,
    0,
    false,
  );

  if (desktopAdd === true && continueProcess === true) {
    workspace.createDesktop(workspace.desktops.length, "");
    workspace.currentDesktop =
      workspace.desktops[workspace.desktops.length - 1];
    windowNew.desktops = [workspace.currentDesktop];
    if (maximizeOpen === true) windowNew.setMaximize(true, true);
  }
}
