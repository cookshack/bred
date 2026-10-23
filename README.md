> [!WARNING]
> Use at your own risk! This is experimental, and far from stable or secure.

I'm playing with CodeMirror inside Electron.

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
#!/bin/bash
cd ~/src/bred && exec bin/bred "$@"
```

If node/npm come from nvm, a launcher started from a desktop icon won't find
them: nvm is only added to PATH by an interactive shell's .bashrc. Source it
first:
```bash
if ! command -v npm >/dev/null; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
```

## Gnome Launcher

1. Create ~/.local/share/applications/bred.desktop with:

    ```ini
    [Desktop Entry]
    Type=Application
    Name=Bred
    Comment=Custom definition for Bred
    Icon=/home/<USERNAME>/src/bred/img/logo.png
    Terminal=false
    Exec=/home/<USERNAME>/bin/bred
    ```

    Point Exec straight at the script: it is not a shell command line, so
    `sh -c "..."` wrappers and redirections either fail silently or are passed
    as literal arguments. Write logs to a file from inside the script instead.

2. Run:

    ```sh
    chmod +x ~/.local/share/applications/bred.desktop
    update-desktop-database ~/.local/share/applications
    ```

3. If clicking the icon does nothing, run `gtk-launch bred` in a terminal: it
   reproduces the launcher's environment and shows the error.

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

#### 5. Missing emojis like 🗩 on Ubuntu

Run:
```sh
sudo apt-get install fonts-noto-core
```
