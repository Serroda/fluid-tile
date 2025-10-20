<p align="center">
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/logo.svg" width="200"/>
</p>

# Fluid tile

A script for Kwin that auto adjusts windows to the custom KDE Plasma tiling layout by creating and removing virtual desktops.

## Support

If you like the project, you can support me by buying me a coffee or with other options available here

<a href='https://ko-fi.com/M4M81LR295' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
<a href="https://liberapay.com/Serroda/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"></a>

## Features

- 🚀 Working on KDE Plasma 6.4 (or superior)
- 🛠️ KWin native tiling
- 🪟 Smooth tiling
- 🖼️ Working with custom layout (Meta + T)
- 💻 Auto create and delete virtual desktops
- ⛔ Blocklist for apps to which you don't want the script to apply
- ⚙️ User options
- 🔢 Configures the priority order of windows according to the width, height and position of the tiles
- 🔳 Select the default tile layout when creating a new virtual desktop

## Preview

[![Watch the video](https://i.ytimg.com/vi/U04QsvblbSA/hqdefault.jpg?sqp=-oaymwFBCNACELwBSFryq4qpAzMIARUAAIhCGAHYAQHiAQoIGBACGAY4AUAB8AEB-AH-CIAC0AWKAgwIABABGH8gHSgZMA8=&rs=AOn4CLDTqR09B7FJOcqmOJQ5cqNI4rwRPA)](https://youtu.be/U04QsvblbSA)

## Screenshots

  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot1.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot2.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot3.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot4.png" width="200"/>
  <img src ="https://codeberg.org/Serroda/fluid-tile/raw/branch/main/.meta/screenshot5.png" width="200"/>

## User options

> **WARNING**: If you change the script settings while it is still active,
> you must deactivate and reactivate it for the changes to take effect.

`Settings > KWin Scripts > Click on the cogwheel icon for the ‘Fluid-tile’ option`

### Alternative option to set user variables

Use this method when you have problems with the configuration form

> **DISCLAMER**: If you do not set any of the variables,
> they will take the default value

- Edit `~/.config/kwinrc`
- Create a new tag or search for the tag with the name `[Script-fluid-tile]`
- Write variables:
  - `AppsBlocklist`: Block list apps, you can add more applications by concatenating the string with `,` and the XDG name of the app

    > **WARNING**: Use the default value
    > and add the new apps at the end or beginning of
    > the string
    - Default: `org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter`

  - `TilesPriority`: Priority of tile parameters for sorting windows

    > **WARNING**: Use the default value and
    > just change the order of the items
    - Default: `Width,Height,Top,Left,Right,Bottom`

  - `MaximizeClose`: Maximize the last window when closing a window
    - Default: `true`
    - Possible values: `true` or `false`
  - `MaximizeOpen`: Maximize the new window
    - Default: `true`
    - Possible values: `true` or `false`
  - `WindowsOrderClose`: Reorder virtual desktop windows when a window is closed
    - Default: `true`
    - Possible values: `true` or `false`
  - `DesktopAdd`: Create a new virtual desktop if there is no space on the other virtual desktops when a window is opening
    - Default: `true`
    - Possible values: `true` or `false`
  - `DesktopRemove`: Remove the virtual desktop if there are no more windows
    - Default: `true`
    - Possible values: `true` or `false`
  - `DesktopRemoveDelay`: Delay (milliseconds) set when deleting a virtual desktop to prevent errors in specific applications and prevent the desktop from being deleted until the window process has finished. Example: the Chrome profile selector that closes and opens a window in milliseconds, causing errors in the script because, in theory, the window has not been closed
    - Default: `300`
    - Possible values: `0` to `5000`
  - `ModalsIgnore`: Ignore transient windows
    - Default: `true`
    - Possible values: `true` or `false`
  - `LayoutDefault`: Layout type set when creating a new virtual desktop
    - Default: `2`
    - Possible values: `1` to `6`

#### Example

```
[Script-fluid-tile]
MaximizeClose=false
DesktopRemove=false
AppsBlocklist=org.kde.plasma.emojier,org.kde.keysmith,org.kde.kded6,qt-sudo,org.kde.polkit-kde-authentication-agent-1,org.kde.spectacle,kcm_kwinrules,org.freedesktop.impl.portal.desktop.kde,krunner,plasmashell,org.kde.plasmashell,kwin_wayland,ksmserver-logout-greeter
TilesPriority=Height,Width,Top,Left,Bottom,Right
```

> **REMEMBER**: you must deactivate and reactivate the script
> for the changes to take effect.

## Installation

### Requirements

You need to have `KWidgetsAddons` installed, find out how to install it for your distribution on internet

### KDE Store **(Recommended)**

`Settings > KWin Scripts > Click on "Get New" button > Search 'Fluid tile' > Install`

[Link](https://store.kde.org/p/2322321)

### Manual

- 1. Download the lastest (`.zip` file) [release link](https://codeberg.org/Serroda/fluid-tile/releases/latest)

- 2. Rename the file extension from `.zip` to `.kwinscript`

- 3. Install the file with KDE settings
     `Settings > KWin Scripts > Install from file > Select the file > Enable "Fluid tile" > Apply changes`

### Git

- 1. Clone the repository

```sh
git clone https://codeberg.org/Serroda/fluid-tile.git -b release --depth 1
```

- 2. Install the script

```sh
kpackagetool6 --type=KWin/Script -i ./fluid-tile/
```

- 3. Enable it in the KDE settings

`Settings > KWin Scripts > Enable "Fluid tile" > Apply changes`

## F.A.Q

### Differences between other tile managers

The main difference is that `Fluid tile` uses the native KWin API to manage windows and layout, ensuring a smoother integration with native KDE, this means that the customization options are more limited for the user compared to other options.

Install `Fluid tile` if you want a native KDE tiling, while if you want something more customized use other options like Krohnkite or Polonium

### Shortcuts

You can use the native KDE shortcuts, my recommendation is to change the shortcuts for `Window Management`, specifically change `Custom Quick Tile Window to the Bottom/Left/Right/Top` to `Meta + Down/Left/Right/Up` for smoother use

### My settings have not been applied

You have to disable and enable **Fluid tile** from `KWin scripts` to apply user settings 
