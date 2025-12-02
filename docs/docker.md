# Docker

To build using docker ensure it is installed and the user is added to the docker group

See [electron builder docs for more detailed example](https://www.electron.build/multi-platform-build#docker)

Script to setup and load docker to allow running build scripts:

```bash
#!/bin/sh

SERVICE_NAME="docker.service" # Replace with the actual service name

if ! systemctl is-active --quiet "$SERVICE_NAME" ; then
  echo "Service '$SERVICE_NAME' is not running attempting to start."
  sudo systemctl start docker
  if ! systemctl is-active --quiet "$SERVICE_NAME" ; then
	echo "Could not start docker service."
	exit
  fi
fi
docker run --privileged --rm -ti \
 --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
 --env ELECTRON_CACHE="/root/.cache/electron" \
 --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
 -v ${PWD}:/project \
 -v ${PWD##*/}-node-modules:/project/node_modules \
 -v ~/.cache/electron:/root/.cache/electron \
 -v ~/.cache/electron-builder:/root/.cache/electron-builder \
electronuserland/builder 
```

The script will check if docker daemon is started, attempt to start it then
run docker with all the correct settings.

Once at the docker prompt run `npm install && npm run release:linux64` to build base packages, `npm install && npm run release:snap-classic` to build snap classic package, or `npm install && npm run release:linux` to build base, flatpak, and snap packages.

See build notes in [README](README.md) for more detailed build steps

**Note** to build flatpak packages see the flatpak setup section below

## Windows

To build windows installer change `electronuserland/builder` to `electronuserland/builder:wine`

Use `npm install && npm run release:win` to build window packages

## Flatpak

To build flatpak package you will need to install flatpak packages in the docker image after it is setup by running the following commands:

```
add-apt-repository ppa:alexlarsson/flatpak
apt update
apt install flatpak flatpak-builder
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08 org.electronjs.Electron2.BaseApp//25.08
```

These commands will add the flatpak repos, install the builder tools, and the required flatpak development packs

Once installed you just need to run `npm install && npm run release:linux` to build all linux packages or `npm install && npm run release:flatpak` for flatpak only package.

## Trouble shooting

- If you get permission denied errors ensure the user is added to the group by running `sudo usermod -aG docker $USER` then log out and back in or use `newgrp docker`
- Errors running linux release, ensure all required build tools are installed, in most cases the flatpak tools are missing and the default linux build script will try and build flatpak, ensure flatpak tools are installed in docker image, or use `release:linux64` instead of `release:linux`
- Errors building windows, ensure you are using `electronuserland/builder:wine` in the script or docker load line