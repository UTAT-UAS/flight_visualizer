const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
export const HOST = urlParams.get('host') || "localhost";
export const SIGNALLING_SERVER = `ws://${HOST}:8443`;
export const ROS_BRIDGE = `ws://${HOST}:8080`;
