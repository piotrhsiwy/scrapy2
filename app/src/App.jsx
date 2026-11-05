import { useState, useEffect} from 'react'
import './App.css'

function Metadata({ username, setIsLoggedIn }){

  const [data, setData] = useState('');
  const [error, setError] = useState('');
  
  useEffect(() => {
    async function fetchMetadata(){
      try {
        const res = await fetch('/api/meta');
        if (res.status === 401){
          setError('Error 401 when fetching metadata')
        } else{
          const data = await res.json();
          const listData = Object.entries(data).map( ( [label, info], index ) => (
            <div className="metadata-item" key={index}>
                <span className="metadata-label">{label}</span>
                <span>{info}</span>
            </div>
          ));
          setData(listData);
        }
      } catch { /* non-critical */ }
    }

    fetchMetadata();

  }, []);

  return (
    <div id="file-metadata" className="metadata-bar">
      <div id="file-metadata" className="metadata-bar">
        { data === '' ? 
          ( error === '' ? 'Loading metadata...' : error)
          : (data)
        }
      </div>
      <button className="btn-logout" onClick={() => setIsLoggedIn(false)}> [ ✕ ] Logout </button>
      <div className="user-label">Current user:</div>
      <span id="user-label"> {username} </span>
    </div>
  )
};

function Controls({ username, setIsLoggedIn, setErrorMessage}){

  const [tab, setTab] = useState('evs');
  const [datetime, setDatetime] = useState(getLocalISOString());
  const [done, setDone] = useState([]);

  async function fetch(){
    //TODO
  }

  function getLocalISOString(date = new Date()) {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset*60*1000));
    return localDate.toISOString().slice(0, 16);
  }

  useEffect(() => {
    //TODO
  }, [datetime])

  return(
    <div className="controls-container">
        <div className="tabs">
            <button id="btn-evs" 
              className={tab === 'evs' ? 'active' : ''}
              onClick={() => setTab('evs')}>
                EVS Data
            </button>
            <button id="btn-arbs" 
              className={tab === 'arbs' ? 'active' : ''}
              onClick={() => setTab('arbs')}>
                ARBS Data
            </button>
            <button id="btn-bets" 
              className={tab === 'bets' ? 'active' : ''}
              onClick={() => setTab('bets')}>
                BETS
            </button>
            <button className="btn-reset" onClick={() => setDone([])}>[ ⟲ ] Reset Done</button>
            <button className="btn-back" onClick={() => setDone(done.slice(0, done.length-1))}>[ ↩ ] Back Done</button>
        </div>
        <div id="slider-container" className="slider-box"></div>
        <div className="filters">
            <div className="datetime-filter-box">
                <label><strong>Min Date/Time:</strong></label>
                <input 
                  type="datetime-local" 
                  id="min-datetime" 
                  step="3600" 
                  value={datetime}
                  onChange={e => setDatetime(e.target.value)}
                />
                <button onClick={() => setDatetime(getLocalISOString())}>NOW</button>
                <button onClick={fetch}>Fetch</button>
            </div>
            <div className="checkbox-group" id="book-filters"></div>
        </div>
    </div>
  )
}

function App({ username, setIsLoggedIn, setErrorMessage }) {

  return (
    <div id="app">

      <Metadata username={username} setIsLoggedIn={setIsLoggedIn}/>

      <div className="header-section">
        <Controls username={username} setIsLoggedIn={setIsLoggedIn} setErrorMessage={setErrorMessage}/>

          <div className="timer-container">
              <span className="timer-label">Refreshing In</span>
              <div id="ascii-timer">[---------------]</div>
          </div>
      </div>

      <div className="table-container" id="table-container">
          <div>Loading data...</div>
      </div>

    </div>
  )
}

export default App