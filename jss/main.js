const API_KEY = 'a3af77f2f03f42cbbe335101250306'; 
const DEFAULT_LOCATION = 'Yeovil';
const FORECAST_DAYS = 10;

// DOM Elements
const heroSection = document.querySelector('.hero');
const locationInput = document.getElementById('locationInput');
const searchButton = document.getElementById('searchButton');
const searchInputError = document.getElementById('searchInputError');
const unitToggleBtn = document.getElementById('unitToggleBtn');
const geolocationBtn = document.getElementById('geolocationBtn');
const weatherResultsArea = document.querySelector('.weather-results-area');
const locationHeaderElement = document.getElementById('locationHeader');
const currentWeatherCard = document.getElementById('currentWeatherCard');
const hourlyForecastContainer = document.getElementById('hourlyForecastContainer');
const forecastGrid = document.getElementById('forecastGrid');
const statusMessageContainer = document.getElementById('statusMessageContainer');
const currentYearSpan = document.getElementById('currentYear');
const autocompleteSuggestionsContainer = document.getElementById('autocompleteSuggestions');
const hourlyDetailsModal = document.getElementById('hourlyDetailsModal');
const closeHourlyModalBtn = document.getElementById('closeHourlyModalBtn');
const modalHourTime = document.getElementById('modalHourTime');
const modalHourlyDetailsGrid = document.getElementById('modalHourlyDetailsGrid');

let searchErrorTimeoutId = null;
let lastSuccessfulWeatherData = null;
let currentUnit = 'celsius';
let isFetchingData = false; 
let debounceTimeout;
let activeSuggestionIndex = -1;
let statusMessageTimeoutId = null;
let scrollDebounceTimeout; 

// --- INITIALIZATION ---
function initializeApp() {
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    loadPreferredUnit();
    addEventListeners();
    fetchWeatherData(DEFAULT_LOCATION, true); 
}

function addEventListeners() {
    searchButton.addEventListener('click', () => {
        hideAutocompleteSuggestions();
        handleSearch();
    });
    locationInput.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') {
            if (autocompleteSuggestionsContainer.style.display === 'none' || activeSuggestionIndex === -1) {
                 hideAutocompleteSuggestions();
                 handleSearch();
            }
        } 
    });
    locationInput.addEventListener('input', debounce( () => fetchAutocompleteSuggestions(locationInput.value), 350));
    locationInput.addEventListener('keydown', handleKeydownOnInput);
    
    document.addEventListener('click', function(event) {
        const isClickInsideInput = locationInput.contains(event.target);
        const isClickInsideSuggestions = autocompleteSuggestionsContainer.contains(event.target);
        if (!isClickInsideInput && !isClickInsideSuggestions) {
            hideAutocompleteSuggestions();
        }
    });

    unitToggleBtn.addEventListener('click', toggleUnit);
    geolocationBtn.addEventListener('click', handleGeolocation);
    
    const mainNav = document.querySelector('header nav');
    if (mainNav) {
        mainNav.addEventListener('click', (event) => {
            if (event.target.closest('a[data-scroll-target]')) {
                handleSmoothScroll(event);
            }
        });
    }

    window.addEventListener('scroll', () => {
        requestAnimationFrame(handleParallax); 
        clearTimeout(scrollDebounceTimeout);
        scrollDebounceTimeout = setTimeout(highlightActiveNavLink, 100); 
    });
    window.addEventListener('load', () => {
        highlightActiveNavLink(); 
        handleParallax(); 
    });
    window.addEventListener('resize', () => {
        highlightActiveNavLink(); 
        handleParallax(); 
    });


    if (closeHourlyModalBtn) {
        closeHourlyModalBtn.addEventListener('click', closeHourlyDetailsModal);
    }
    if (hourlyDetailsModal) {
        hourlyDetailsModal.addEventListener('click', (event) => {
            if (event.target === hourlyDetailsModal) {
                closeHourlyDetailsModal();
            }
        });
    }
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && hourlyDetailsModal && hourlyDetailsModal.classList.contains('visible')) {
            closeHourlyDetailsModal();
        }
    });

    window.addEventListener('online', () => {
        showStatusMessage("You are back online!", 'success', 3000);
        if (!lastSuccessfulWeatherData && locationInput.value) { 
            handleSearch(); 
        } else if (!lastSuccessfulWeatherData && !locationInput.value) {
            fetchWeatherData(DEFAULT_LOCATION);
        }
    });
    window.addEventListener('offline', () => {
        showStatusMessage("You are offline. Some features may not be available.", 'error', 5000);
    });
}

function clearSearchInputError() {
    if (searchInputError.classList.contains('visible')) {
        searchInputError.classList.remove('visible');
        searchInputError.textContent = ''; 
        if (searchErrorTimeoutId) clearTimeout(searchErrorTimeoutId);
    }
}

function handleParallax() {
    if (heroSection) {
        const scrollY = window.pageYOffset;
        heroSection.style.backgroundPositionY = `calc(50% + ${scrollY * 0.3}px)`; 
    }
}

function handleSmoothScroll(event) {
    const link = event.target.closest('a[data-scroll-target]');
    if (link) {
        event.preventDefault();
        const targetId = link.getAttribute('data-scroll-target');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            const headerElement = document.querySelector('header');
            let headerHeight = headerElement ? headerElement.offsetHeight : 0;
            
            if (window.innerWidth <= 768 && headerElement) {
                const headerContainer = headerElement.querySelector('.header-container');
                if (headerContainer && getComputedStyle(headerContainer).flexDirection === 'column') {
                     headerHeight = headerContainer.offsetHeight;
                }
            }
            const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20; 
            window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
    }
}

function highlightActiveNavLink() {
    const navLinks = document.querySelectorAll('nav ul li a[data-scroll-target]');
    if (navLinks.length === 0) return;

    const headerElement = document.querySelector('header');
    let headerHeight = headerElement ? headerElement.offsetHeight : 0;
     if (window.innerWidth <= 768 && headerElement) { 
        const headerContainer = headerElement.querySelector('.header-container');
        if (headerContainer && getComputedStyle(headerContainer).flexDirection === 'column') {
             headerHeight = headerContainer.offsetHeight;
        }
    }
    let currentSectionId = '';
    navLinks.forEach(link => {
        const targetId = link.getAttribute('data-scroll-target');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            if (rect.top <= headerHeight + 50 && rect.bottom >= headerHeight + 50) { 
                if (!currentSectionId) { 
                    currentSectionId = targetId;
                }
            }
        }
    });
    
    if (!currentSectionId && window.pageYOffset < (document.querySelector('#hero-section-target')?.offsetHeight || window.innerHeight) * 0.5) {
         currentSectionId = navLinks[0]?.getAttribute('data-scroll-target');
    }

    navLinks.forEach(link => {
        if (link.getAttribute('data-scroll-target') === currentSectionId) {
            link.classList.add('active-nav-link');
        } else {
            link.classList.remove('active-nav-link');
        }
    });
}


function loadPreferredUnit() {
    const savedUnit = localStorage.getItem('weatherAppUnit');
    currentUnit = savedUnit === 'fahrenheit' ? 'fahrenheit' : 'celsius';
    updateUnitToggleUI();
}
function toggleUnit() {
    currentUnit = currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
    localStorage.setItem('weatherAppUnit', currentUnit);
    updateUnitToggleUI();
    if (lastSuccessfulWeatherData) displayAllWeatherData(lastSuccessfulWeatherData); 
}
function updateUnitToggleUI() {
    unitToggleBtn.textContent = currentUnit === 'celsius' ? '°C' : '°F';
}
function getTemp(c, f, unitSymbol = true) {
    const symbol = unitSymbol ? (currentUnit === 'celsius' ? '°C' : '°F') : '';
    if (currentUnit === 'fahrenheit') return f !== undefined ? `${Math.round(f)}${symbol}` : 'N/A';
    return c !== undefined ? `${Math.round(c)}${symbol}` : 'N/A';
}

async function handleGeolocation() {
    if (isFetchingData) return;
    if (!navigator.geolocation) {
        showTemporaryError("Geolocation not supported.", 3000); return;
    }
    
    geolocationBtn.disabled = true;
    geolocationBtn.classList.add('geolocation-btn--loading'); 
    hideAutocompleteSuggestions();
    clearSearchInputError();
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, 
                timeout: 15000, 
                maximumAge: 0 
            });
        });
        
        console.log('Geolocation Coordinates:', position.coords.latitude, position.coords.longitude);
        locationInput.value = ''; 
        fetchWeatherData(`${position.coords.latitude},${position.coords.longitude}`);
    } catch (error) {
        let msg = "Location error: ";
        switch (error.code) {
            case error.PERMISSION_DENIED: msg += "Permission denied."; break;
            case error.POSITION_UNAVAILABLE: msg += "Location unavailable."; break;
            case error.TIMEOUT: msg += "Request timed out."; break;
            default: msg += "Unknown error. " + (error.message || ''); break;
        }
        showTemporaryError(msg, 4000);
        console.error("Geolocation Error:", error);
        if (lastSuccessfulWeatherData) {
            weatherResultsArea.classList.add('visible');
        }
    } finally {
        geolocationBtn.disabled = false;
        geolocationBtn.classList.remove('geolocation-btn--loading'); 
    }
}

function debounce(func, delay) {
    return function(...args) {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => func.apply(this, args), delay);
    };
}

async function fetchAutocompleteSuggestions(query) {
    if (query.length < 2) {
        hideAutocompleteSuggestions();
        return;
    }
    const url = `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Autocomplete API error:", response.status);
            hideAutocompleteSuggestions();
            return;
        }
        const suggestions = await response.json();
        if (suggestions.length === 0 && query.length > 1) { 
            autocompleteSuggestionsContainer.innerHTML = '<li><small>No matching locations found.</small></li>';
            autocompleteSuggestionsContainer.style.display = 'block';
            activeSuggestionIndex = -1;
        } else {
            displayAutocompleteSuggestions(suggestions, query);
        }
    } catch (error) {
        console.error('Fetch Autocomplete Error:', error);
        hideAutocompleteSuggestions();
    }
}

function displayAutocompleteSuggestions(suggestions, query) {
    if (!autocompleteSuggestionsContainer) return;
    if (!suggestions || suggestions.length === 0) {
        hideAutocompleteSuggestions();
        return;
    }

    const suggestionsList = document.createElement('ul');
    suggestions.forEach(suggestion => {
        const listItem = document.createElement('li');
        let displayText = suggestion.name;
        if (suggestion.region && suggestion.region !== suggestion.name) displayText += `, ${suggestion.region}`;
        if (suggestion.country && suggestion.country !== suggestion.name && suggestion.country !== suggestion.region) displayText += `, ${suggestion.country}`;
        
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        listItem.innerHTML = displayText.replace(regex, '<strong>$1</strong>');
        
        listItem.addEventListener('click', () => {
            locationInput.value = `${suggestion.name}, ${suggestion.country}`; 
            fetchWeatherData(locationInput.value);
            hideAutocompleteSuggestions();
        });
        suggestionsList.appendChild(listItem);
    });

    autocompleteSuggestionsContainer.innerHTML = '';
    autocompleteSuggestionsContainer.appendChild(suggestionsList);
    autocompleteSuggestionsContainer.style.display = 'block';
    activeSuggestionIndex = -1;
}

function hideAutocompleteSuggestions() {
    if (autocompleteSuggestionsContainer) {
        autocompleteSuggestionsContainer.innerHTML = '';
        autocompleteSuggestionsContainer.style.display = 'none';
    }
    activeSuggestionIndex = -1;
}

function handleKeydownOnInput(e) {
    if (!autocompleteSuggestionsContainer) return;
    const suggestionsItems = autocompleteSuggestionsContainer.querySelectorAll('li');
    if (suggestionsItems.length === 0 || autocompleteSuggestionsContainer.style.display === 'none') {
         if (e.key === 'Enter') { 
            hideAutocompleteSuggestions();
            handleSearch();
         }
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestionsItems.length;
        updateActiveSuggestion(suggestionsItems);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeSuggestionIndex = (activeSuggestionIndex - 1 + suggestionsItems.length) % suggestionsItems.length;
        updateActiveSuggestion(suggestionsItems);
    } else if (e.key === 'Enter') {
        e.preventDefault(); 
        if (activeSuggestionIndex > -1 && suggestionsItems[activeSuggestionIndex]) {
            suggestionsItems[activeSuggestionIndex].click(); 
        } else {
             hideAutocompleteSuggestions(); 
             handleSearch();
        }
    } else if (e.key === 'Escape') {
        hideAutocompleteSuggestions();
    }
}

function updateActiveSuggestion(items) {
    items.forEach(item => item.classList.remove('active-suggestion'));
    if (activeSuggestionIndex > -1 && items[activeSuggestionIndex]) {
        items[activeSuggestionIndex].classList.add('active-suggestion');
        items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }
}

function openHourlyDetailsModal(hourData) {
    if (!hourlyDetailsModal || !modalHourTime || !modalHourlyDetailsGrid) return;

    const hourDate = new Date(hourData.time_epoch * 1000);
    modalHourTime.textContent = `${hourDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at ${hourDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;

    modalHourlyDetailsGrid.innerHTML = `
        <p><i class="fas fa-temperature-full"></i> <strong>Temp:</strong> ${getTemp(hourData.temp_c, hourData.temp_f)}</p>
        <p><i class="fas fa-temperature-half"></i> <strong>Feels Like:</strong> ${getTemp(hourData.feelslike_c, hourData.feelslike_f)}</p>
        <p><img src="https:${hourData.condition.icon}" alt="${hourData.condition.text}"> <strong>Condition:</strong> ${hourData.condition.text}</p>
        <p><i class="fas fa-wind"></i> <strong>Wind:</strong> ${Math.round(hourData.wind_kph)} kph (${hourData.wind_dir})</p>
        <p><i class="fas fa-compass"></i> <strong>Wind Gust:</strong> ${Math.round(hourData.gust_kph)} kph</p>
        <p><i class="fas fa-tint"></i> <strong>Humidity:</strong> ${hourData.humidity}%</p>
        <p><i class="fas fa-cloud-rain"></i> <strong>Rain Chance:</strong> ${hourData.chance_of_rain}%</p>
        <p><i class="fas fa-snowflake"></i> <strong>Snow Chance:</strong> ${hourData.chance_of_snow}%</p>
        <p><i class="fas fa-eye"></i> <strong>Visibility:</strong> ${hourData.vis_km} km</p>
        <p><i class="fas fa-gauge-high"></i> <strong>Pressure:</strong> ${hourData.pressure_mb} mb</p>
        <p><i class="fas fa-sun"></i> <strong>UV Index:</strong> ${hourData.uv}</p>
    `;

    hourlyDetailsModal.classList.add('visible');
}

function closeHourlyDetailsModal() {
    if (hourlyDetailsModal) {
        hourlyDetailsModal.classList.remove('visible');
    }
}

function showTemporaryError(message, duration = 3000) { 
    searchInputError.textContent = message;
    searchInputError.classList.add('visible');
    if (searchErrorTimeoutId) clearTimeout(searchErrorTimeoutId);
    searchErrorTimeoutId = setTimeout(() => {
        searchInputError.classList.remove('visible');
         setTimeout(() => { searchInputError.textContent = ''; }, 300); 
    }, duration);
}

function showStatusMessage(message, type = 'info', duration = 4000) {
    if (!statusMessageContainer) return;
    if (statusMessageTimeoutId) clearTimeout(statusMessageTimeoutId);

    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    
    if (type === 'error') messageDiv.className = 'error-message';
    else if (type === 'success') messageDiv.className = 'success-message';
    else if (type === 'info') messageDiv.className = 'info-message';
    else messageDiv.className = 'status-message';

    statusMessageContainer.innerHTML = ''; 
    statusMessageContainer.appendChild(messageDiv);
    statusMessageContainer.classList.add('visible'); 

    if (duration > 0) {
        statusMessageTimeoutId = setTimeout(() => {
            statusMessageContainer.classList.remove('visible');
            setTimeout(() => { 
                if (statusMessageContainer.contains(messageDiv)) { 
                   statusMessageContainer.innerHTML = '';
                }
            }, 300); 
        }, duration);
    }
}

function showGeneralError(message) { 
    showStatusMessage(message, 'error', 0); 
    if(currentWeatherCard) currentWeatherCard.innerHTML = ''; 
    if(hourlyForecastContainer) hourlyForecastContainer.innerHTML = '';
    if(forecastGrid) forecastGrid.innerHTML = '';
    if(locationHeaderElement) locationHeaderElement.innerHTML = '';
    if(weatherResultsArea) weatherResultsArea.classList.remove('visible');
    lastSuccessfulWeatherData = null; 
}

function clearGeneralError() {
    if (statusMessageContainer) {
        statusMessageContainer.classList.remove('visible');
        statusMessageContainer.innerHTML = '';
    }
    if (statusMessageTimeoutId) clearTimeout(statusMessageTimeoutId);
}

function showLoaders() {
    if (!lastSuccessfulWeatherData || !weatherResultsArea.classList.contains('visible')) {
        if(weatherResultsArea) weatherResultsArea.classList.remove('visible');
        if(locationHeaderElement) locationHeaderElement.innerHTML = '';

        if(currentWeatherCard) currentWeatherCard.innerHTML = `
            <div class="skeleton-current-weather">
                <div><div class="skeleton-icon-main"></div></div>
                <div class="skeleton-details-main">
                    <div class="skeleton-line-large"></div>
                    <div class="skeleton-line-medium" style="width: 70%;"></div>
                </div>
                <div class="skeleton-grid" style="grid-column: 1 / -1;">
                    <div class="skeleton-line-small"></div> <div class="skeleton-line-small"></div>
                    <div class="skeleton-line-small"></div> <div class="skeleton-line-small"></div>
                    <div class="skeleton-line-small"></div> <div class="skeleton-line-small"></div>
                </div>
            </div>`;

        if(hourlyForecastContainer) {
            let hourlySkeletonsHTML = '<div class="skeleton-hourly-card-container">';
            for (let i = 0; i < 5; i++) {
                hourlySkeletonsHTML += `
                    <div class="skeleton-hourly-card">
                        <div class="skeleton-line-xsmall" style="width: 60%;"></div>
                        <div class="skeleton-icon-small"></div>
                        <div class="skeleton-line-small" style="width: 70%;"></div>
                        <div class="skeleton-line-xsmall" style="width: 50%;"></div>
                    </div>`;
            }
            hourlySkeletonsHTML += '</div>';
            hourlyForecastContainer.innerHTML = hourlySkeletonsHTML;
        }

        if(forecastGrid){
            let dailySkeletonsHTML = '<div class="skeleton-forecast-grid">';
            const numDailySkeletons = window.innerWidth < 768 ? 3 : 5;
            for (let i = 0; i < numDailySkeletons; i++) { 
                dailySkeletonsHTML += `
                    <div class="skeleton-forecast-card">
                        <div class="skeleton-line-small" style="width: 50%;"></div>
                        <div class="skeleton-icon-medium"></div>
                        <div class="skeleton-line-medium" style="width: 70%;"></div>
                        <div class="skeleton-line-small" style="width: 90%;"></div>
                        <div class="skeleton-line-xsmall" style="width: 60%;"></div>
                    </div>`;
            }
            dailySkeletonsHTML += '</div>';
            forecastGrid.innerHTML = dailySkeletonsHTML;
        }
        
        document.querySelectorAll('.loader-container').forEach(lc => lc.classList.add('hidden-by-skeleton'));
    }
}

function handleSearch() { 
    if (isFetchingData) return;
    const query = locationInput.value.trim();
    if (!query) {
        showTemporaryError("Please enter a city name."); return;
    }
    clearSearchInputError();
    hideAutocompleteSuggestions(); 
    fetchWeatherData(query);
}

async function fetchWeatherData(locationQuery, isInitialLoad = false) {
    if (isFetchingData && !isInitialLoad) return; 
    isFetchingData = true;
    
    if (!navigator.onLine) {
        showStatusMessage("You are offline. Cannot fetch weather data.", 'error', 5000);
        if (isInitialLoad || !lastSuccessfulWeatherData) {
            showGeneralError("You are offline. Please check your internet connection.");
        }
        isFetchingData = false;
        return;
    }

    if (isInitialLoad || !lastSuccessfulWeatherData) { 
        showLoaders();
    }
    clearGeneralError(); 

    const url = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(locationQuery)}&days=${FORECAST_DAYS}&aqi=yes&alerts=yes`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            let errorMsg = `Error: ${response.status} ${response.statusText}`;
            let isCritical = false; 

            if (response.status === 400) {
                const errorData = await response.json().catch(() => null);
                errorMsg = (errorData && errorData.error && errorData.error.message) 
                           ? errorData.error.message 
                           : "Invalid location or API request. Please check the city name.";
                showTemporaryError(errorMsg, 4000); 
            } else if (response.status === 401 || response.status === 403) {
                errorMsg = "API key error or access denied. Please contact support.";
                isCritical = true;
            } else if (response.status === 429) { 
                errorMsg = "Too many requests. Please try again in a few minutes.";
                showStatusMessage(errorMsg, 'error', 5000);
            } else if (response.status >= 500) { 
                errorMsg = "Weather service is temporarily unavailable. Please try again later.";
                showStatusMessage(errorMsg, 'error', 5000);
            } else { 
                const errorData = await response.json().catch(() => null);
                errorMsg = (errorData && errorData.error && errorData.error.message) 
                           ? errorData.error.message
                           : `Could not fetch weather data (${response.status})`;
                showTemporaryError(errorMsg, 4000);
            }
            
            const fetchError = new Error(errorMsg);
            fetchError.isCritical = isCritical; 
            fetchError.responseStatus = response.status;
            throw fetchError;
        }
        const data = await response.json();
        
        lastSuccessfulWeatherData = data; 
        displayAllWeatherData(data);      
        
        if (!isInitialLoad) { 
            if(document.getElementById('weather-results-target')) {
               document.getElementById('weather-results-target').scrollIntoView({ behavior: 'smooth' });
            }
        }

    } catch (error) {
        console.error('Fetch Weather Error:', error.message, error);
        
        if (error.isCritical || (isInitialLoad && !lastSuccessfulWeatherData)) {
            showGeneralError(`Failed to load weather: ${error.message}`);
        } else if (!lastSuccessfulWeatherData && error.responseStatus === 400) {
            showGeneralError(`Could not find weather for "${locationQuery}". Please check the name.`);
        } else if (lastSuccessfulWeatherData) {
            if(weatherResultsArea) weatherResultsArea.classList.add('visible');
            displayAllWeatherData(lastSuccessfulWeatherData); // Re-display last good data
            if (error.responseStatus !== 429 && error.responseStatus < 500 && error.responseStatus !== 400 ) { 
                showTemporaryError(error.message || "Could not update weather data.", 4000);
            }
        } else {
             showGeneralError(`Could not fetch weather data. ${error.message}`);
        }
    } finally {
        isFetchingData = false;
    }
}

function displayWeatherAlerts(alertsData) {
    const alertsContainer = document.getElementById('weatherAlertsContainer');
    if (!alertsContainer) return;

    alertsContainer.innerHTML = ''; 
    alertsContainer.style.display = 'none'; 

    if (alertsData && alertsData.alert && alertsData.alert.length > 0) {
        const alertsList = document.createElement('ul');
        alertsList.className = 'alerts-list';

        alertsData.alert.forEach(alertItem => {
            const listItem = document.createElement('li');
            listItem.className = 'alert-item';
            if (alertItem.severity) {
                listItem.classList.add(`alert-severity-${alertItem.severity.toLowerCase().replace(/\s+/g, '-')}`);
            }

            listItem.innerHTML = `
                <h4 class="alert-headline"><i class="fas fa-triangle-exclamation"></i> ${alertItem.headline}</h4>
                <p class="alert-event"><strong>Event:</strong> ${alertItem.event || 'N/A'}</p>
                <p class="alert-description">${alertItem.desc || 'No further details.'}</p>
                <p class="alert-instruction"><em>${alertItem.instruction || ''}</em></p>
                ${alertItem.areas ? `<p class="alert-areas"><strong>Affected Areas:</strong> ${alertItem.areas}</p>` : ''}
            `;
            alertsList.appendChild(listItem);
        });

        alertsContainer.appendChild(alertsList);
        alertsContainer.style.display = 'block'; 
    }
}

function displayAllWeatherData(data) {
    clearGeneralError(); 
    if(currentWeatherCard) currentWeatherCard.classList.remove('content-visible'); 
    
    displayWeatherAlerts(data.alerts); 
    const todayAstroData = data.forecast && data.forecast.forecastday && data.forecast.forecastday.length > 0 ? data.forecast.forecastday[0].astro : null;
    displayCurrentWeather(data.location, data.current, todayAstroData); 

    if (data.forecast && data.forecast.forecastday && data.forecast.forecastday.length > 0 && data.forecast.forecastday[0].hour) {
        displayHourlyForecast(data.forecast.forecastday[0].hour);
    } else {
        if(hourlyForecastContainer) hourlyForecastContainer.innerHTML = '<p style="padding: 10px; text-align:center; width:100%;">Hourly forecast data not available.</p>';
    }
    
    if (data.forecast && data.forecast.forecastday) {
        displayDailyForecast(data.forecast.forecastday);
    } else {
         if(forecastGrid) forecastGrid.innerHTML = '<p style="padding: 10px; text-align:center; width:100%; grid-column: 1 / -1;">Daily forecast data not available.</p>';
    }
    if(weatherResultsArea) weatherResultsArea.classList.add('visible'); 
}

function displayCurrentWeather(location, current, astroData) {
    if(!locationHeaderElement || !currentWeatherCard) return;

    locationHeaderElement.innerHTML = `<h2>${location.name}, ${location.country}</h2>`;
    
    const feelsLikeTempC = current.feelslike_c;
    const feelsLikeTempF = current.feelslike_f;

    let aqiValueDisplay = 'N/A'; 
    let aqiClass = 'aqi-na';    
    if (current.air_quality && current.air_quality['us-epa-index']) {
        const epaIndex = current.air_quality['us-epa-index'];
        let aqiText = '';
        switch (epaIndex) {
            case 1: aqiText = ' (Good)'; aqiClass = 'aqi-good'; break;
            case 2: aqiText = ' (Moderate)'; aqiClass = 'aqi-moderate'; break;
            case 3: aqiText = ' (Unhealthy for sensitive groups)'; aqiClass = 'aqi-unhealthy-sensitive'; break;
            case 4: aqiText = ' (Unhealthy)'; aqiClass = 'aqi-unhealthy'; break;
            case 5: aqiText = ' (Very Unhealthy)'; aqiClass = 'aqi-very-unhealthy'; break;
            case 6: aqiText = ' (Hazardous)'; aqiClass = 'aqi-hazardous'; break;
            default: aqiText = ''; aqiClass = 'aqi-na';
        }
        aqiValueDisplay = `${epaIndex}${aqiText}`;
    }

    let sunriseTime = 'N/A';
    let sunsetTime = 'N/A';
    if (astroData) {
        sunriseTime = astroData.sunrise ? astroData.sunrise.trim() : 'N/A';
        sunsetTime = astroData.sunset ? astroData.sunset.trim() : 'N/A';
    }
    
    const heroSectionElement = document.querySelector('.hero'); 
    if (heroSectionElement) {
        const unsplashParams = 'auto=format&fit=crop&w=1600&q=75';
        let backgroundImage = `url('https://images.unsplash.com/photo-1500340520802-1687637c03a4?ixlib=rb-4.0.3&${unsplashParams}')`; 
        const conditionText = current.condition.text.toLowerCase();
        const isDay = current.is_day === 1;

        if (!isDay) { 
            if (conditionText.includes('clear') || conditionText.includes('sunny')) { 
                backgroundImage = `url('https://images.unsplash.com/photo-1472552944129-b035e9ea3744?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('cloudy') || conditionText.includes('overcast') || conditionText.includes('partly cloudy')) {
                 backgroundImage = `url('https://images.unsplash.com/photo-1502404642721-6c0009003757?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('rain') || conditionText.includes('drizzle') || conditionText.includes('shower')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1518803194020-5948167f754d?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('snow') || conditionText.includes('sleet') || conditionText.includes('blizzard')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1483018835330-9e2a05804947?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('mist') || conditionText.includes('fog')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1480497490787-505ec076689f?ixlib=rb-4.0.3&${unsplashParams}')`;
            }
        } else { 
            if (conditionText.includes('sunny') || conditionText.includes('clear')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1601297183305-9df1427fe523?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('partly cloudy')) {
                 backgroundImage = `url('https://images.unsplash.com/photo-1566995290510-5c0a4568eed5?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('cloudy') || conditionText.includes('overcast')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1501630834273-4b5604d2eb39?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('rain') || conditionText.includes('drizzle') || conditionText.includes('shower')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('snow') || conditionText.includes('sleet') || conditionText.includes('blizzard')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1517299321609-524b03535a49?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('mist') || conditionText.includes('fog')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1431958283943-f6578b2c45e5?ixlib=rb-4.0.3&${unsplashParams}')`;
            } else if (conditionText.includes('thunder')) {
                backgroundImage = `url('https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?ixlib=rb-4.0.3&${unsplashParams}')`;
            }
        }
        if (heroSectionElement.style.backgroundImage !== backgroundImage) { 
            heroSectionElement.style.backgroundImage = backgroundImage;
        }
    }

    currentWeatherCard.innerHTML = `
        <div class="weather-icon-temp">
            <img src="https:${current.condition.icon}" alt="${current.condition.text}" class="current-icon">
            <p class="current-temperature">${getTemp(current.temp_c, current.temp_f)}</p>
            <p class="current-condition">${current.condition.text}</p>
        </div>
        <div class="current-details-grid">
            <p><i class="fas fa-temperature-half" title="Feels Like"></i> <strong>Feels Like:</strong> ${getTemp(feelsLikeTempC, feelsLikeTempF)}</p>
            <p><i class="fas fa-tint" title="Humidity" style="color: #3498db;"></i> <strong>Humidity:</strong> ${current.humidity}%</p>
            <p><i class="fas fa-wind" title="Wind" style="color: #95a5a6;"></i> <strong>Wind:</strong> ${Math.round(current.wind_kph)} kph / ${Math.round(current.wind_mph)} mph ${current.wind_dir}</p>
            <p><i class="fas fa-gauge-high" title="Pressure" style="color: #16a085;"></i> <strong>Pressure:</strong> ${current.pressure_mb} mb</p>
            <p><i class="fas fa-eye" title="Visibility" style="color: #2980b9;"></i> <strong>Visibility:</strong> ${current.vis_km} km / ${current.vis_miles} miles</p>
            <p><i class="fas fa-sun" title="UV Index" style="color: #f39c12;"></i> <strong>UV Index:</strong> ${current.uv}</p>
            <p><i class="fas fa-cloud" title="Cloud Cover" style="color: #bdc3c7;"></i> <strong>Cloud Cover:</strong> ${current.cloud}%</p>
            <p><i class="fas fa-smog" title="Air Quality Index"></i> <strong>AQI (US EPA):</strong> <span class="${aqiClass}">${aqiValueDisplay}</span></p>
            <p><i class="fas fa-sunrise" title="Sunrise" style="color: #f39c12;"></i> <strong>Sunrise:</strong> ${sunriseTime}</p>
            <p><i class="fas fa-sunset" title="Sunset" style="color: #e67e22;"></i> <strong>Sunset:</strong> ${sunsetTime}</p>
            <p><i class="fas fa-clock" title="Last Updated" style="color: #7f8c8d;"></i> <strong>Last Updated:</strong> ${new Date(current.last_updated_epoch * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
    `;
    requestAnimationFrame(() => {
        if(currentWeatherCard) currentWeatherCard.classList.add('content-visible');
    });
}

function displayHourlyForecast(hourlyDataFullDay) {
    if(!hourlyForecastContainer) return;
    hourlyForecastContainer.innerHTML = ''; 
    if (!hourlyDataFullDay || hourlyDataFullDay.length === 0) {
        hourlyForecastContainer.innerHTML = `<p style="padding: 10px; text-align:center; width:100%;">Hourly forecast data not available.</p>`;
        return;
    }

    hourlyDataFullDay.forEach((hour, index) => {
        const hourDate = new Date(hour.time_epoch * 1000);
        const card = document.createElement('div');
        card.className = 'hourly-card'; 
        card.innerHTML = `
            <p class="time">${hourDate.toLocaleTimeString([], { hour: 'numeric', hour12: true })}</p>
            <img src="https:${hour.condition.icon}" alt="${hour.condition.text}" class="condition-icon">
            <p class="temp">${getTemp(hour.temp_c, hour.temp_f)}</p>
            <p class="chance-of-rain"><i class="fas fa-tint" style="color: #3498db;"></i> ${hour.chance_of_rain}%</p>
        `;
        card.addEventListener('click', () => openHourlyDetailsModal(hour));
        hourlyForecastContainer.appendChild(card);
        setTimeout(() => card.classList.add('visible'), index * 60); 
    });
}

function displayDailyForecast(forecastDays) {
    if(!forecastGrid) return;
    forecastGrid.innerHTML = ''; 
    if (!forecastDays || forecastDays.length === 0) {
         forecastGrid.innerHTML = `<p style="padding: 10px; text-align:center; width:100%; grid-column: 1 / -1;">Daily forecast data not available.</p>`;
         return;
    }
    forecastDays.forEach((dayData, index) => {
        const day = dayData.day;
        const card = document.createElement('div');
        card.className = 'forecast-card'; 
        const date = new Date(dayData.date_epoch * 1000);
        const dayName = index === 0 ? "Today" : date.toLocaleDateString([], { weekday: 'short' });
        
        card.innerHTML = `
            <p class="date">${dayName} <span style="font-weight:normal; font-size:0.8em">(${date.toLocaleDateString([], {month:'short', day:'numeric'})})</span></p>
            <img src="https:${day.condition.icon}" alt="${day.condition.text}" class="forecast-icon">
            <p class="temperature">${getTemp(day.avgtemp_c, day.avgtemp_f)}</p>
            <p class="condition">${day.condition.text}</p>
            <p class="min-max">
                <i class="fas fa-temperature-arrow-up" title="Max Temperature" style="color: #e74c3c;"></i> ${getTemp(day.maxtemp_c, day.maxtemp_f, false)} / 
                <i class="fas fa-temperature-arrow-down" title="Min Temperature" style="color: #3498db;"></i> ${getTemp(day.mintemp_c, day.mintemp_f, false)}
            </p>
            <p class="chance-of-rain" style="font-size: 0.75rem; margin-top: 4px;"><i class="fas fa-tint" style="color: #3498db;"></i> Rain: ${day.daily_chance_of_rain}%</p>
        `;
        forecastGrid.appendChild(card);
        setTimeout(() => card.classList.add('visible'), index * 100); 
    });
}
document.addEventListener('DOMContentLoaded', initializeApp);