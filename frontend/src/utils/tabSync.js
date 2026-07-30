const channel = new BroadcastChannel('nirmaan_session');

export const broadcastUpdate = (type, payload) => {
  channel.postMessage({ type, payload });
};

export const onSessionUpdate = (callback) => {
  channel.onmessage = ({ data }) => callback(data);
};
