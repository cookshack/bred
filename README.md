> [!WARNING]
> Use at your own risk! This is experimental, and far from stable or secure.

I'm playing with CodeMirror and Ace inside Electron.

![4 Breds](https://git.sr.ht/~mattmundell/bred/blob/main/etc/shot.png)

## Install

```sh
mkdir -p ~/src/
cd ~/src
git clone https://git.sr.ht/~mattmundell/bred
cd ~/src/bred
npm install
```

### Optional: Install Icons

```sh
cd ~/src && git clone git@github.com:domtronn/all-the-icons.el.git
cd ~/src/bred/lib
ln -s ../../all-the-icons.el/svg svg
```

## Run

```sh
cd ~/src/bred/ && bin/bred
```

## Update
```sh
cd ~/src/bred
git pull
```

## CLI

Create ~/bin/bred with:
```bash
#!/usr/bin/env bash
cd ~/src/bred/ && bin/bred $*
```

## Gnome Launcher

1. Create ~/.local/share/applications/userapp-bred.desktop with:

    ```ini
    [Desktop Entry]
    Encoding=UTF-8
    Version=1.0
    Type=Application
    Exec=sh -e "/home/<USERNAME>/bin/bred > /dev/null 2>&1"
    Name=Bred
    Comment=Custom definition for Bred
    Icon=/home/<USERNAME>/src/bred/img/logo.png
    Terminal=false
    ```

2. Run:

    ```sh
    update-desktop-database ~/.local/share/applications
    ```

## Optional OS packages

```sh
# For extra highlighting of patches.
sudo apt-get install diffr
```

## Issues

#### 1. Sandbox error

On startup, if you see an error like
```
The SUID sandbox helper binary was found, but is not configured
correctly. Rather than run without sandboxing I'm aborting now.
```
or like this
```
No usable sandbox! Update your kernel or see https://... for more information on
developing with the SUID sandbox. If you want to live dangerously and need an
immediate workaround, you can try using --no-sandbox.
```
then create an AppArmor profile:
```sh
sudo ~/src/bred/bin/armor
```
See: https://github.com/electron/electron/issues/42510#issuecomment-2332919348

#### 2. "no new privileges" error

If you want to run privileged commands from the editor, and you're getting an error like this:
```
sudo: The "no new privileges" flag is set, which prevents sudo from running as root.
sudo: If sudo is running in a container, you may need to adjust the container configuration to disable the flag.
```
then create an AppArmor profile, as in 1 above.

#### 3. "node-pty" errors on startup

Run:
```sh
make fix-node-pty
```

#### 4. "better_sqlite3" errors on startup

Run:
```sh
make fix-sqlite3
```
