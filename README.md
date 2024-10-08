> [!WARNING]
> Use at your own risk! This is experimental, and far from stable or secure.

I'm playing with CodeMirror, Monaco and Ace inside Electron.

## Install

```sh
mkdir -p ~/src/
cd ~/src
git clone XXX:bred
cd ~/src/bred
npm install
make prep
```

### Optional: Install Icons

```sh
cd ~/src && git clone git@github.com:domtronn/all-the-icons.el.git
cd ~/src/bred/lib
ln -s ../../all-the-icons.el/svg svg
```

## Run

```sh
cd ~/src/bred/ && npm start
```

## Update
```sh
cd ~/src/bred
git pull
npm install
make prep
```

## CLI

Create ~/bin/bred with:
```bash
#!/bin/bash
cd ~/src/bred/ && npm start -- $*
```

## Gnome Launcher

1. Create ~/.local/share/applications/userapp-bred.desktop with:

    ```
    [Desktop Entry]
    Encoding=UTF-8
    Version=1.0
    Type=Application
    Exec=/home/<USERNAME>/bin/bred
    Name=Bred
    Comment=Custom definition for Bred
    Icon=/home/<USERNAME>/src/bred/img/logo.png
    Terminal=false
    ```

2. Run:

    ```sh
    update-desktop-database ~/.local/share/applications
    ```

## Issues

#### 1. Sandbox error

If you see an error like this on startup:
```
The SUID sandbox helper binary was found, but is not configured
correctly. Rather than run without sandboxing I'm aborting now.
```
then add `--no-sandbox` to the start command, for example:
```sh
cd ~/src/bred/ && npm start -- --no-sandbox
```
See https://github.com/electron/electron/issues/17972.

#### 2. "no new privileges" error

If you want to run privileged commands from the editor, and you're getting an error like this:
```
sudo: The "no new privileges" flag is set, which prevents sudo from running as root.
sudo: If sudo is running in a container, you may need to adjust the container configuration to disable the flag.
```
then add `--no-setuid-sandbox` to the start command, for example:
```sh
cd ~/src/bred/ && npm start -- --no-setuid-sandbox
```

#### 3. "node-pty" errors on startup

Run:
```sh
make fix-node-pty

```
