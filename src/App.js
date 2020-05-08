import React, {useEffect, useState, useRef} from 'react';
import AppBar from "@material-ui/core/AppBar";
import Typography from "@material-ui/core/Typography";
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import { makeStyles } from "@material-ui/core/styles";
import Video, { Participant } from 'twilio-video';

import './App.css';

const useStyles = makeStyles(theme => ({
    title: {
      flexGrow: 1,
      fontWeight: 600,
      padding: '1rem'
    },
    textField: {
      width: '250px',
      marginTop: '1rem'
    }
}));

function App() {
  const classes = useStyles();
  const [identity, setIdentity] = useState('');
  const [token, setToken] = useState('');
  const [roomName, setRoomName] = useState('');
  const [localMediaAvailable, setLocalMediaAvailable] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomNameErr, setRoomNameErr] = useState(false);
  const [previewTracks, setPreviewTracks] = useState(null);

  const localMedia = useRef(null);
  const remoteMedia = useRef(null);

   const handleRoomName = (event) => {
     setRoomName(event.target.value);
   }

  const url = 'https://flax-cichlid-9789.twil.io/client-video-token'
  useEffect(() => {
    fetch(url, {
      method: 'get',
      headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
      },
    }).then(res => res.json())
    .then(json => {
      setIdentity(json.identiy);
      setToken(json.token);
    })
  }, [])

  // ---------------------------- triggered when user joins the room -----------------
  const joinRoom = () => {
    if (!roomName.trim()) {
      setRoomNameErr(true);
      return;
    }
 
    console.log("Joining room '" + roomName + "'...");
    let connectOptions = {
      audio: true,
      name: roomName,
      video: {
        width: 400
      }
    };
 
    if (previewTracks) {
        connectOptions.tracks = previewTracks;
    }
 
    /* 
    Connect to a room by providing the token and connection    options that include the room name and tracks. We also show an alert if an error occurs while connecting to the room.    
    */  
    Video.connect(token, connectOptions).then(roomJoined, error => {
      alert('Could not connect to Twilio: ' + error.message);
    });
    // remove this fetch if you just want to do a standalone demo
    fetch('https://flax-cichlid-9789.twil.io/flex-video-token', {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room: roomName,
          identity: identity
        })
        }).then(res => res.json())
        .then((json) => {
          console.log(json)
        })
  }
  // --------------- end of join room function ---------------

  // -------------- local participant tracks -----------------
  const attachLocalTrack = (tracks, container) => {
    tracks.forEach(track => {
      container.appendChild(track.track.attach());
    });
  }
    
  const attachLocalParticipantTracks = (participant, container) => {
    var tracks = Array.from(participant.tracks.values());
      attachLocalTrack(tracks, container);
  }
  // -------------- end of local participant tracks ----------------

  // --------------- leave room and unsubscribe to tracks ----------------
  const leaveRoom = () => {
    activeRoom.disconnect();
    setHasJoinedRoom(false);
    setLocalMediaAvailable(false);
  }

  const getTracks = (participant) => {
    return Array.from(participant.tracks.values()).filter(function (publication) {
       return publication.track;
    }).map(function (publication) {
       return publication.track;
    });
  }

  const detachTracks = (tracks) => {
      for (let track of tracks) {
        const htmlElements = track.detach();
        for (let htmlElement of htmlElements) {
          htmlElement.remove();
        }
      }
    }

  const detachParticipantTracks = (participant) => {
    var tracks = getTracks(participant);
    console.log(tracks);
    detachTracks(tracks);
  }

  const onParticipantUnpublishedTrack = (track, trackPublication) => {
    detachTracks([track]);
 }
 // ------------------ end of leave room and unsubscribe to tracks --------------------

  // ----------- remote participant --------------
  const attachRemoteTracks = (track, container) => {
    container.appendChild(track.attach());
  }

  function trackPublished(publication, participant) {
    console.log(`RemoteParticipant ${participant.identity} published a RemoteTrack: ${publication}`);
  
    publication.on('subscribed', track => {
      console.log(`LocalParticipant subscribed to a RemoteTrack: ${track}`);
      var previewContainer = remoteMedia.current;
      attachRemoteTracks(track, previewContainer)
    });
  
    publication.on('unsubscribed', track => {
      console.log(`LocalParticipant unsubscribed from a RemoteTrack: ${track}`);
    });
  }

  function participantConnected(participant) {
    participant.tracks.forEach(publication => {
      trackPublished(publication, participant);
    });
  
    participant.on('trackPublished', publication => {
      trackPublished(publication, participant);
    });
  
    participant.on('trackUnpublished', publication => {
      console.log(`RemoteParticipant ${participant.identity} unpublished a RemoteTrack: ${publication}`);
    });
  }
  // -------------------- end of remote participant -------------------

  // --------------------- callback function once participant successfully joins a room -----------------
  const roomJoined = (room) => {
    console.log(room);
    // Called when a participant joins a room
    console.log("Joined as '" + identity + "'");
    setActiveRoom(room);
    setLocalMediaAvailable(true);
    setHasJoinedRoom(true);
  
    // Attach LocalParticipant's tracks to the DOM, if not already attached.
    var previewContainer = localMedia.current;

    if (!previewContainer.querySelector('video')) {
      attachLocalParticipantTracks(room.localParticipant, previewContainer);
    }

    // Attach the Tracks of the room's participants.
    room.participants.forEach(participant => {
        console.log("Already in Room: '" + participant.identity + "'");
        console.log(participant);
        participantConnected(participant)
    });

    // Participant joining room
    room.on('participantConnected', participantConnected);

    // Detach all participant’s track when they leave a room.
    room.on('participantDisconnected', detachParticipantTracks);

    room.on('trackUnsubscribed', onParticipantUnpublishedTrack);

    // Once the local participant leaves the room, detach the Tracks
    // of all other participants, including that of the LocalParticipant.
    room.on('disconnected', () => {
      if (previewTracks) {
        console.log('particpant disconnected, stopping tracks')
        previewTracks.forEach(track => {
          track.stop();
        });
      }
      detachParticipantTracks(room.localParticipant);
      room.participants.forEach(detachParticipantTracks);
      setActiveRoom(null)
      setHasJoinedRoom(false);
      setLocalMediaAvailable(false);
    });

  }

  // ----------------------- end of join room callback --------------------------

  return (
    <div className="App">
      <AppBar position="static">
        <Typography variant="h6" align="center" className={classes.title}>
          DHL
        </Typography>
      </AppBar>

      <div className="flex-item" >
        {localMediaAvailable? 
          <div><div ref={localMedia} id="localMedia" /></div>
          :
          ''
        }
      </div>

      <TextField label="Enter something unique"  className={classes.textField} onChange={handleRoomName} />
      <div>
        {
          !hasJoinedRoom? 
          <Button color="primary" onClick={joinRoom} >Join Room</Button> 
          : 
          <Button color="secondary" onClick={leaveRoom} >Leave Room</Button>
        }
      </div>

      <div className="flex-item" ref={remoteMedia} id="remote-media" />
    </div>
  );
}

export default App;
