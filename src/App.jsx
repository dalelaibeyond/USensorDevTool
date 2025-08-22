
import './App.css';
import mqtt from 'mqtt';
import { useState, useEffect } from 'react';
import { V5008ToJson } from './utils/v5008';
import { V6800ToJson } from './utils/v6800';
import { G6000ToJson } from './utils/g6000';
import { formatTimestamp, formatValue, isV5008, isV6800, isG6000 } from './utils/tools';

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

      if (isV5008(topic)) {

        const parsedMessage = V5008ToJson(topic, message);
        const formatedMessage = formatValue(parsedMessage);
        logEvent('Message', `[${topic}] \n${formatedMessage}`);

      }
      else if (isV6800(topic)) {

        const parsedMessage = V6800ToJson(topic, message);
        const formatedMessage = formatValue(parsedMessage);
        logEvent('Message', `[${topic}] \n${formatedMessage}`);

      }
      else if (isG6000(topic)) {

        const parsedMessage = G6000ToJson(topic, message);
        const formatedMessage = formatValue(parsedMessage);
        logEvent('Message', `[${topic}] \n${formatedMessage}`);

      }
      else {

        logEvent('Error', `Unsupported topic: ${topic}`);

      }


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
            <img src="/icon-dashboard.svg" alt="Dashboard Icon" className="icon" /> Sensor Data Dashboard
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
                        fontFamily: 'sans-serif, monospace',//'Roboto Condensed, monospace',
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
