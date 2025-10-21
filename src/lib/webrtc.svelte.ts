import GstWebRTCAPI from "gstwebrtc-api";
import type ConsumerSession from "gstwebrtc-api/types/consumer-session";
import type { Peer } from "gstwebrtc-api/types/gstwebrtc-api";

export interface StreamSet {
    api: GstWebRTCAPI | null,
    producers: Record<string, Peer>,
    sessions: Record<string, ConsumerSession>
}

export const stream = $state<StreamSet>({
    api: null,
    producers: {},
    sessions: {}
})

export function initRemoteStreams() {
    // @ts-expect-error
    stream.api = new GstWebRTCAPI({
        meta: { name: 'WebClient-UAS' },
        signalingServerUrl: 'ws://localhost:8443'
    });

    stream.api.registerPeerListener({
        producerAdded: (producer: Peer) => {
            stream.producers[producer.id] = producer
        }
    });
}

// function initRemoteStreams(api) {
//     const remoteStreamsElement = document.getElementById("remote-streams");

//     const listener = {
//         producerAdded: function (producer) {
//             const producerId = producer.id
//             if (!document.getElementById(producerId)) {
//                 remoteStreamsElement.insertAdjacentHTML("beforeend",
//                     `<li id="${producerId}">
//                                 <div class="button">${producer.meta.name || producerId}
//                                 </div>
//                                 <div class="offer-options">
//                                   <textarea rows="5" cols="50" placeholder="offer options, empty to answer. For example:\n{\n  &quot;offerToReceiveAudio&quot;: 1\n  &quot;offerToReceiveVideo&quot;: 1\n}\n"></textarea>
//                                 </div>
//                                 <div class="request-box">
//                                   <textarea rows="4" cols="50" placeholder="JSON request to send over"></textarea>
//                                   <button disabled="disabled">Submit request</button>
//                                 </div>
//                                 <div class="video">
//                                     <div class="spinner">
//                                         <div></div>
//                                         <div></div>
//                                         <div></div>
//                                         <div></div>
//                                     </div>
//                                     <span class="remote-control">&#xA9;</span>
//                                     <video></video>
//                                     <div class="fullscreen"><span title="Toggle fullscreen">&#x25A2;</span></div>
//                                 </div>
//                             </li>`);

//                 const entryElement = document.getElementById(producerId);
//                 const videoElement = entryElement.getElementsByTagName("video")[0];
//                 const offerTextareaElement = entryElement.getElementsByTagName("textarea")[0];
//                 const requestTextAreaElement = entryElement.getElementsByTagName("textarea")[1];
//                 const submitRequestButtonElement = entryElement.getElementsByTagName("button")[0];

//                 submitRequestButtonElement.addEventListener("click", (event) => {
//                     try {
//                         let request = requestTextAreaElement.value;
//                         let id = entryElement._consumerSession.remoteController.sendControlRequest(request);
//                     } catch (ex) {
//                         console.error("Failed to parse mix matrix:", ex);
//                         return;
//                     }
//                 });

//                 videoElement.addEventListener("playing", () => {
//                     if (entryElement.classList.contains("has-session")) {
//                         entryElement.classList.add("streaming");
//                     }
//                 });

//                 entryElement.addEventListener("click", (event) => {
//                     event.preventDefault();
//                     if (!event.target.classList.contains("button")) {
//                         return;
//                     }

//                     if (entryElement._consumerSession) {
//                         entryElement._consumerSession.close();
//                     } else {
//                         let session = null;
//                         if (offerTextareaElement.value == '') {
//                             session = api.createConsumerSession(producerId);
//                         } else {
//                             try {
//                                 let offerOptions = JSON.parse(offerTextareaElement.value);
//                                 session = api.createConsumerSessionWithOfferOptions(producerId, offerOptions);
//                             } catch (ex) {
//                                 console.error("Failed to parse offer options:", ex);
//                                 return;
//                             }
//                         }
//                         if (session) {
//                             entryElement._consumerSession = session;

//                             session.mungeStereoHack = true;

//                             session.addEventListener("error", (event) => {
//                                 if (entryElement._consumerSession === session) {
//                                     console.error(event.message, event.error);
//                                 }
//                             });

//                             session.addEventListener("closed", () => {
//                                 if (entryElement._consumerSession === session) {
//                                     videoElement.pause();
//                                     videoElement.srcObject = null;
//                                     entryElement.classList.remove("has-session", "streaming", "has-remote-control");
//                                     delete entryElement._consumerSession;
//                                 }
//                             });

//                             session.addEventListener("streamsChanged", () => {
//                                 if (entryElement._consumerSession === session) {
//                                     const streams = session.streams;
//                                     if (streams.length > 0) {
//                                         videoElement.srcObject = streams[0];
//                                         videoElement.play().catch(() => { });
//                                     }
//                                 }
//                             });

//                             session.addEventListener("remoteControllerChanged", () => {
//                                 if (entryElement._consumerSession === session) {
//                                     const remoteController = session.remoteController;
//                                     if (remoteController) {
//                                         entryElement.classList.add("has-remote-control");
//                                         submitRequestButtonElement.disabled = false;
//                                         remoteController.attachVideoElement(videoElement);
//                                         remoteController.addEventListener("info", (e) => {
//                                             console.log("Received info message from producer: ", e.detail);
//                                         });
//                                     } else {
//                                         entryElement.classList.remove("has-remote-control");
//                                         submitRequestButtonElement.disabled = true;
//                                     }
//                                 }
//                             });

//                             entryElement.classList.add("has-session");
//                             session.connect();
//                         }
//                     }
//                 });
//             }
//         },

//         producerRemoved: function (producer) {
//             const element = document.getElementById(producer.id);
//             if (element) {
//                 if (element._consumerSession) {
//                     element._consumerSession.close();
//                 }

//                 element.remove();
//             }
//         }
//     };

//     api.registerPeerListener(listener);
//     // for (const producer of api.getAvailableProducers()) {
//     //     listener.producerAdded(producer);
//     // }
// }
