Qt.include("defaults.js");
Qt.include("blocklist.js");
Qt.include("windows.js");
Qt.include("tiles.js");
Qt.include("triggers.js");

workspace.windowAdded.connect(onOpenWindow);
workspace.windowRemoved.connect(onCloseWindow);
