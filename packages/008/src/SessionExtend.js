import { Session } from 'sip.js';

Session.prototype.isVideo = function () {
  if (!this.isInbound())
    return this.sessionDescriptionHandlerOptions.constraints?.video;

  return (
    this.request?.body?.includes?.('m=video') ||
    this.request?.body?.body?.includes?.('m=video')
  );
};

Session.prototype.setMuted = function (muted) {
  const { peerConnection } = this.sessionDescriptionHandler;
  peerConnection.getLocalStreams().forEach(stream => {
    stream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  });
};

Session.prototype.setMutedVideo = function (muted) {
  const { peerConnection } = this.sessionDescriptionHandler;
  peerConnection.getLocalStreams().forEach(stream => {
    stream.getVideoTracks().forEach(track => {
      track.enabled = !muted;
    });
  });
};

Session.prototype.isInbound = function () {
  return this.incomingRequest !== undefined;
};

Session.prototype.autoanswer = function () {
  return this.request.getHeader('X-Autoanswer');
};
