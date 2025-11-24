import { useTiles } from "./tiles";

export function useUI(workspace, config) {
  const apiTile = useTiles(workspace, config);
  const layoutOrdered = [];
  let windowFocused = {};
  let windowGeometryOnMove = {};
  let UIVisible = false;
  let tileActived = -1;

  //Save tile when user focus a window
  function onUserFocusWindow(windowMain) {
    if (windowMain.active === true) {
      windowFocused.tile = windowMain.tile;
      windowFocused.window = windowMain;
    }
  }

  // When a window start move with the cursor, reset ui
  function onUserMoveStart() {
    layoutOrdered = [];
    layoutOrdered = apiTile.getTilesFromActualDesktop();
  }

  // When a window is moving with the cursor
  function onUserMoveStepped(windowGeometry) {
    if (
      windowGeometryOnMove.width === undefined &&
      windowGeometryOnMove.height === undefined
    ) {
      windowGeometryOnMove = {
        width: windowGeometry.width,
        height: windowGeometry.height,
      };
    }

    if (
      windowGeometryOnMove.width !== windowGeometry.width &&
      windowGeometryOnMove.height !== windowGeometry.height
    ) {
      return;
    }

    UIVisible = true;

    const cursor = workspace.cursorPos;
    tileActived = layoutOrdered.findIndex((tile) => {
      const limitX = tile.absoluteGeometry.x + tile.absoluteGeometry.width;
      const limitY = tile.absoluteGeometry.y + tile.absoluteGeometry.height;
      return (
        tile.absoluteGeometry.x <= cursor.x &&
        limitX >= cursor.x &&
        tile.absoluteGeometry.y <= cursor.y &&
        limitY >= cursor.y
      );
    });
  }

  //When the user release the window
  function onUserMoveFinished(windowMoved) {
    if (UIVisible === true) {
      UIVisible = false;
      layoutOrdered[tileActived]?.manage(windowMoved);
      windowGeometryOnMove = {};
      tileActived = -1;
    }
  }

  return {
    onUserMoveFinished,
    onUserMoveStepped,
    onUserMoveStart,
    onUserFocusWindow,
    UIVisible,
    layoutOrdered,
    tileActived,
  };
}
