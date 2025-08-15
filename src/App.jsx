import { useState, useEffect } from 'react';
import mqtt from 'mqtt';
import { V5008ToJson } from './utils/v5008';
import './App.css';

function App() {
  const [broker, setBroker] = useState('');
  const [port, setPort] = useState('');
  const [client, setClient] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [publishTopic, setPublishTopic] = useState('');
  const [publishMessage, setPublishMessage] = useState('');
  const [subscribeTopic, setSubscribeTopic] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [appLog, setAppLog] = useState([]);

  const maxLogEntries = 500; // Maximum number of log entries to keep

  const formatTimestamp = (date) => {
    //const options = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' };
    const options = { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false};
    return date.toLocaleString('en-US', options).replace(',', '');
  };

function isValidIdentifier(str) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(str);
}

function colorKey(text) {
  return `<span style="color: #000000ff;">${text}</span>`;
}

function colorString(text) {
  return `<span style="color: #0b770bff;">'${text}'</span>`; // green
}

function colorNumber(text) {
  return `<span style="color: #b1b10fff;">${text}</span>`; // yellow
}

function formatObject(obj, indent) {
  const pad = '  '.repeat(indent);
  const maxKeyLength = Math.max(
    ...Object.keys(obj).map(k => (isValidIdentifier(k) ? k.length : k.length + 2))
  );

  return Object.entries(obj)
    .map(([k, v]) => {
      const keyStr = isValidIdentifier(k) ? k : `'${k}'`;
      const spaces = ' ';//.repeat(maxKeyLength - keyStr.length);
      return `${'  '.repeat(indent + 1)}${colorKey(keyStr)}${spaces}: ${formatValue(v, indent + 1)}`;
    })
    .join(',\n');
}

function formatValue(value, indent = 0) {
  const pad = '  '.repeat(indent);

  if (Array.isArray(value)) {
    const isSimpleObjectArray =
      value.length > 0 &&
      value.every(
        v =>
          typeof v === 'object' &&
          v !== null &&
          !Array.isArray(v) &&
          Object.values(v).every(
            val => typeof val === 'string' || typeof val === 'number' || val === null
          )
      );

    if (isSimpleObjectArray) {
      const maxKeyLength = Math.max(
        ...value.flatMap(obj =>
          Object.keys(obj).map(k => (isValidIdentifier(k) ? k.length : k.length + 2))
        )
      );

      const arrStr = value
        .map(obj => {
          const fields = Object.entries(obj)
            .map(([k, val]) => {
              const keyStr = isValidIdentifier(k) ? k : `'${k}'`;
              const spaces = ' '.repeat(maxKeyLength - keyStr.length);
              return `${colorKey(keyStr)}${spaces}: ${
                typeof val === 'string' ? colorString(val) : colorNumber(val)
              }`;
            })
            .join(', ');
          return `{ ${fields} }`;
        })
        .join(',\n' + '  '.repeat(indent + 1));
      return `[\n${'  '.repeat(indent + 1)}${arrStr}\n${pad}]`;
    } else {
      const arrStr = value.map(v => formatValue(v, indent + 1)).join(',\n');
      return `[\n${arrStr}\n${pad}]`;
    }
  } else if (typeof value === 'object' && value !== null) {
    return `{\n${formatObject(value, indent)}\n${pad}}`;
  } else if (typeof value === 'string') {
    return colorString(value);
  } else if (typeof value === 'number') {
    return colorNumber(value);
  } else {
    return String(value);
  }
}

  const logEvent = (type, message) => {
    const timestamp = formatTimestamp(new Date());
    setAppLog((prevLog) => {
      const newLog = [`[${timestamp}] ${type} | ${message}`, ...prevLog];
      return newLog.slice(0, maxLogEntries); // Limit to last 500 entries
    });
  };

  const connect = () => {
    const url = `ws://${broker}:${port}`;
    const mqttClient = mqtt.connect(url);

    const connectionTimeout = setTimeout(() => {
      if (!mqttClient.connected) {
        logEvent('Error', 'Connection timeout');
        mqttClient.end();
        setIsConnected(false);
        setClient(null);
      }
    }, 10000); // 10 seconds timeout

    mqttClient.on('connect', () => {
      clearTimeout(connectionTimeout);
      setIsConnected(true);
      setClient(mqttClient);
      logEvent('Info', 'MQTT broker connected');
    });

    mqttClient.on('message', (topic, message) => {

      const parsedMessage = V5008ToJson(topic, message);
      const formatedMessage = formatValue(parsedMessage);
      logEvent('Message', `[${topic}] \n${formatedMessage}`);

    });

    mqttClient.on('error', (err) => {
      logEvent('Error', `Connection error: ${err.message}`);
      if (client) {
        client.end();
        setIsConnected(false);
        setClient(null);
      }
    });
  };

  const disconnect = () => {
    if (client) {
      client.end();
      setIsConnected(false);
      setClient(null);
      logEvent('Info', 'MQTT broker disconnected');
    }
  };

  const publish = () => {
    const trimMessage = publishMessage.replace(/\s+/g, '');
    logEvent('Info', `Publish Message: [${publishTopic}] [${trimMessage}]`);
    if (client && publishTopic && trimMessage) {
      client.publish(publishTopic, trimMessage);
    }
  };

  const subscribe = () => {
    if (client && subscribeTopic) {
      const topics = subscribeTopic.split(',').map(t => t.trim()).filter(Boolean);

      const subscriptionTimeout = setTimeout(() => {
        logEvent('Error', 'Subscription timeout');
      }, 5000); // 5 seconds timeout

      topics.forEach((topic) => {
        client.subscribe(topic, undefined, (err) => {
          clearTimeout(subscriptionTimeout);
          if (!err) {
            setIsSubscribed(true);
            logEvent('Info', `Subscribed to the topics: ${topics.join(', ')}`);
          } else {
            logEvent('Error', `Subscription error: ${err.message}`);
          }
        });
      });
    }
  };

  const unsubscribe = () => {
    if (client && subscribeTopic) {
      const topics = subscribeTopic.split(',').map(t => t.trim()).filter(Boolean);
      topics.forEach((topic) => {
        client.unsubscribe(topic, undefined, (err) => {
          if (!err) {
            setIsSubscribed(false);
            logEvent('Info', `Unsubscribed from the topics: ${topics.join(', ')}`);
          }
        });
      });
    }
  };

  const clearLog = () => setAppLog([]);

  const saveMessagesToFile = () => { 
    // Get the content inside the <pre> tag
    //const content = appLog.join('\n');
    const plainTextContent = appLog.join('\n').replace(/<[^>]*>/g, ''); // Strip HTML tags

    // Create a Blob from the content
    const blob = new Blob([plainTextContent], { type: 'text/plain' });

    // Create a temporary anchor tag to trigger the download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'app-log.txt';  // You can name the file whatever you like

    // Append the link to the body, click it to trigger the download, then remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  };

  useEffect(() => {
    const handleUnload = () => {
      if (client) {
        client.end();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (client) {
        client.end();
      }
    };
  }, [client]);

  const formatLogEntry = (entry) => {
    return entry.replace(/"(\w+)":/g, '<span class="log-key">"$1":</span>')
                .replace(/: "(.*?)"/g, ': <span class="log-value">"$1"</span>');
  };

  /////////////////////////////////////////////////////////

   return (
    <div className="app">
      <div className="container">
        <div className="header">
          <h1 className="title">
            <img src="/icon-dashboard.svg" alt="Dashboard Icon" className="icon" /> Sensor Messages Dashboard
          </h1>
          <p className="subtitle">Connect, subscribe, and publish MQTT messages</p>
        </div>

        <div className="grid">
          {/* Left Panel */}
          <div className="left-panel">
            {/* MQTT Connection Panel */}
            <div className="card">

              <div className="card-header">
                <h3 className="card-title">
                  {isConnected ? (
                    <img src="/icon-connected.svg" alt="Connected Icon" className="icon-status connected" />
                  ) : (
                    <img src="/icon-disconnected.svg" alt="Disconnected Icon" className="icon-status disconnected" />
                  )}
                  MQTT Connection
                  <span className={`badge ${isConnected ? 'connected' : 'disconnected'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </h3>
              </div>

              <div className="card-content">
                <div className="input-row">
                  <div className="input-group">
                    <label htmlFor="broker-ip">Broker IP</label>                    
                    <input
                      id="broker-ip"
                      type="text"
                      placeholder="localhost"
                      value={broker}
                      onChange={(e) => setBroker(e.target.value)}
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="port">Port</label>
                    <input
                      id="port"
                      type="text"
                      placeholder="61614"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                    />
                    </div>
                </div>
                <div className="button-row">
                  <button 
                    onClick={connect} 
                    disabled={isConnected || !broker || !port}  
                    className="btn btn-primary"
                  >
                    Connect
                  </button>
                  <button 
                    onClick={disconnect} 
                    disabled={!isConnected}
                    className="btn btn-secondary"
                  >
                    Disconnect
                  </button>
                </div>

                <div className="separator"></div>

                <div className="input-group">
                  <label htmlFor="subscribe-topics">Subscribe</label>
                  <div className="input-with-button" style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="subscribe-topics"
                      type="text"
                      placeholder="V5008Upload/#"
                      value={subscribeTopic}
                      onChange={(e) => setSubscribeTopic(e.target.value)}
                    />
                    <button
                      onClick={subscribe}
                      disabled={!isConnected || !subscribeTopic.trim() || isSubscribed}
                      className="btn btn-sm"
                      style={isSubscribed ? { backgroundColor: '#ccc', color: '#888', cursor: 'not-allowed' } : {}}
                    >
                      Subscribe
                    </button>
                    <button
                      onClick={unsubscribe}
                      disabled={!isConnected || !isSubscribed}
                      className="btn btn-sm"
                      style={!isSubscribed ? { backgroundColor: '#ccc', color: '#888', cursor: 'not-allowed' } : {}}
                    >
                      Unsubscribe
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Publish Panel */}
            <div className="card card-flex">
              <div className="card-header">
                <h3 className="card-title">
                  <img src="/icon-publish.svg" alt="Publish Icon" className="icon-status" />
                  Publish
                </h3>
              </div>
              <div className="card-content card-content-flex">
                <div className="input-group">
                  <label htmlFor="publish-topic">Publish Topic</label>
                  <div className="input-with-button">
                    <input
                      id="publish-topic"
                      type="text"
                      placeholder="V5008Download/{hub_id}"
                      value={publishTopic}
                      onChange={(e) => setPublishTopic(e.target.value)}
                    />
                    <button 
                      onClick={publish}
                      disabled={!isConnected || !publishTopic.trim() || !publishMessage.trim()}
                      className="btn btn-sm"
                    >
                      Publish
                    </button>
                  </div>
                </div>

                <div className="input-group input-group-flex">
                  <label htmlFor="publish-message">Publish Message</label>
                  <textarea
                    id="publish-message"
                    placeholder="Enter your message here..."
                    value={publishMessage}
                    onChange={(e) => setPublishMessage(e.target.value)}
                    className="textarea-large"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <div className="right-panel">
            <div className="card card-full">
              <div className="card-header">
                <h3 className="card-title">
                  <img src="/icon-messages.svg" alt="Messages Icon" className="icon-status" />
                  Terminal Log
                </h3>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm" onClick={clearLog} type="button">Clear Log</button>
                  <button className="btn btn-sm" onClick={saveMessagesToFile} type="button">Save to File</button>
                </div>

              </div>

              <div
                className="card-content card-content-full"
                style={{ minHeight: '780px', overflowY: 'auto' }} // Scrollable box
              >
                
                 <pre
                      style={{

                        backgroundColor: '#f0efe7',//'#f3eeeeff',
                        padding: '10px',
                        borderRadius: '10px',
                        fontFamily: 'Adelle,Roboto Slab,DejaVu Serif,Georgia,Times New Roman,sans-serif',//'Roboto Condensed, monospace',
                        fontSize: '13px',
                        overflowX: 'auto',
                        
                        margin: 0,
                        minHeight: '772px',
                        maxHeight: '772px',
                      }}
                      dangerouslySetInnerHTML={{ __html: appLog.join('\n') }}
                    />


              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
