# Flight Visualizer


## Developing

First install the [gstwebrtc-api](https://gitlab.freedesktop.org/gstreamer/gst-plugins-rs/-/tree/gstreamer-1.26.7/net/webrtc/gstwebrtc-api?ref_type=tags) module:

```sh
git submodule update --init
cd gst-plugins-rs/net/webrtc/gstwebrtc-api
npm install
npm run make
```

Run the app in dev mode:

```sh
pnpm install
pnpm run dev --host
```

## Building

```sh
pnpm run build
```

You can preview the production build with `npm run preview`.
