const API_KEY = 'a3af77f2f03f42cbbe335101250306';
const loadingOverlay = document.getElementById('loading-overlay');
const errorMessageBox = document.getElementById('error-message-box');
const errorTextElement = document.getElementById('error-text');

let currentWeatherData = null;
let currentTemperatureUnit = 'c';
let lastSearchedQuery = 'Yeovil';
let debounceTimer;

const elements = {
    locationName: document.getElementById('location-name-display'),
    currentDateTime: document.getElementById('current-datetime-display'),
    lastUpdatedDisplay: document.getElementById('last-updated-display'),
    mainWeatherIcon: document.getElementById('main-weather-icon-display'),
    currentTemperature: document.getElementById('current-temperature-display'),
    currentCondition: document.getElementById('current-condition-display'),
    feelsLike: document.getElementById('feels-like-display'),
    wind: document.getElementById('wind-display'),
    humidity: document.getElementById('humidity-display'),
    rainToday: document.getElementById('rain-today-display'),
    pressure: document.getElementById('pressure-display'),
    uvIndex: document.getElementById('uv-index-display'),
    aqiDisplay: document.getElementById('aqi-display'),
    hourlyList: document.getElementById('hourly-forecast-list-display'),
    dailyGrid: document.getElementById('daily-forecast-grid-display'),
    searchInput: document.getElementById('location-search-input'),
    searchButton: document.getElementById('search-button'),
    searchClearButton: document.getElementById('search-clear-button'),
    autocompleteSuggestionsContainer: document.getElementById('autocomplete-suggestions'),
    searchGroup: document.querySelector('.search-group'),
    geolocationButton: document.getElementById('geolocation-button'),
    themeToggleButton: document.getElementById('theme-toggle-button'),
    unitToggleButton: document.getElementById('unit-toggle-button'),
    weatherDetailsGrid: document.querySelector('.weather-details-grid')
};

const elementsToFade = Object.values(elements).filter(el => el && !el.id.includes('button') && !el.id.includes('input'));

const weatherConditionMap = {1000:{iconId:"icon-sun"},1003:{iconId:"icon-cloud-sun"},1006:{iconId:"icon-cloud"},1009:{iconId:"icon-cloud"},1030:{iconId:"icon-cloud"},1063:{iconId:"icon-showers"},1066:{iconId:"icon-snow"},1069:{iconId:"icon-rain"},1072:{iconId:"icon-rain"},1087:{iconId:"icon-thunderstorm"},1114:{iconId:"icon-snow"},1117:{iconId:"icon-snow"},1135:{iconId:"icon-cloud"},1147:{iconId:"icon-cloud"},1150:{iconId:"icon-showers"},1153:{iconId:"icon-showers"},1168:{iconId:"icon-rain"},1171:{iconId:"icon-rain"},1180:{iconId:"icon-showers"},1183:{iconId:"icon-rain"},1186:{iconId:"icon-rain"},1189:{iconId:"icon-rain"},1192:{iconId:"icon-rain"},1195:{iconId:"icon-rain"},1198:{iconId:"icon-rain"},1201:{iconId:"icon-rain"},1204:{iconId:"icon-rain"},1207:{iconId:"icon-rain"},1210:{iconId:"icon-snow"},1213:{iconId:"icon-snow"},1216:{iconId:"icon-snow"},1219:{iconId:"icon-snow"},1222:{iconId:"icon-snow"},1225:{iconId:"icon-snow"},1237:{iconId:"icon-snow"},1240:{iconId:"icon-showers"},1243:{iconId:"icon-showers"},1246:{iconId:"icon-showers"},1249:{iconId:"icon-rain"},1252:{iconId:"icon-rain"},1255:{iconId:"icon-snow"},1258:{iconId:"icon-snow"},1261:{iconId:"icon-snow"},1264:{iconId:"icon-snow"},1273:{iconId:"icon-thunderstorm"},1276:{iconId:"icon-thunderstorm"},1279:{iconId:"icon-thunderstorm"},1282:{iconId:"icon-thunderstorm"},night_default:{iconId:"icon-cloud"},default:{iconId:"icon-default"}};

function getMappedWeather(conditionCode, isDay) {
    const condition = weatherConditionMap[conditionCode];
    if (!isDay && condition && condition.iconId === 'icon-sun') {
        return weatherConditionMap.night_default || weatherConditionMap.default;
    }
    return condition || weatherConditionMap.default;
}

function createSvgIcon(iconId, altText = "Weather icon") {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-label', altText);
    svg.setAttribute('role', 'img');
    const svgSymbol = document.querySelector(`#${iconId}`) || document.querySelector('#icon-default');
    if (svgSymbol) {
        svg.setAttribute('viewBox', svgSymbol.getAttribute('viewBox') || '0 0 24 24');
        svg.innerHTML = `<use xlink:href="#${iconId}"></use>`;
    } else {
        svg.innerHTML = '⚠️';
    }
    return svg;
}

function showLoading(message = "Fetching weather data...") {
    const loadingText = loadingOverlay.querySelector('p');
    if (loadingText) loadingText.textContent = message;
    loadingOverlay.style.display = "flex";
}

function hideLoading() {
    loadingOverlay.style.display = "none";
}

function showError(message, duration = 6000) {
    errorTextElement.textContent = message;
    errorMessageBox.style.display = "flex";
    hideLoading();
    setTimeout(() => { errorMessageBox.style.display = "none"; }, duration);
}

function setTheme(theme) {
    const themeIconMoon = elements.themeToggleButton.querySelector('.theme-icon-moon');
    const themeIconSun = elements.themeToggleButton.querySelector('.theme-icon-sun');
    if (theme === 'light') {
        document.body.classList.add("light-mode");
        themeIconMoon.style.display = "none";
        themeIconSun.style.display = "block";
        localStorage.setItem("weatherwise-theme", "light");
    } else {
        document.body.classList.remove("light-mode");
        themeIconMoon.style.display = "block";
        themeIconSun.style.display = "none";
        localStorage.setItem("weatherwise-theme", "dark");
    }
}

function setTemperatureUnit(unit) {
    currentTemperatureUnit = unit.toLowerCase() === 'f' ? 'f' : 'c';
    elements.unitToggleButton.textContent = `°${currentTemperatureUnit.toUpperCase()}`;
    localStorage.setItem("weatherwise-temp-unit", currentTemperatureUnit);
    if (currentWeatherData) updateUI(currentWeatherData, false);
}

function getAqiMeaning(usEpaIndex) {
    const meanings = {
        1: { text: "Good", className: "aqi-good" },
        2: { text: "Moderate", className: "aqi-moderate" },
        3: { text: "Unhealthy (Sensitive)", className: "aqi-sensitive" },
        4: { text: "Unhealthy", className: "aqi-unhealthy" },
        5: { text: "Very Unhealthy", className: "aqi-very-unhealthy" },
        6: { text: "Hazardous", className: "aqi-hazardous" }
    };
    return meanings[usEpaIndex] || { text: "N/A", className: "" };
}

async function fetchWeatherData(query) {
    elementsToFade.forEach(el => el && el.classList.add("is-updating"));
    showLoading("Fetching weather data...");
    lastSearchedQuery = query;
    const apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(query)}&days=10&aqi=yes&alerts=no`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "API error. Invalid response." } }));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        }
        currentWeatherData = await response.json();
        updateUI(currentWeatherData, true);
    } catch (error) {
        showError(error.message || "Could not fetch weather data.");
        updateUI(null, false);
    } finally {
        hideLoading();
        elementsToFade.forEach(el => el && el.classList.remove("is-updating"));
    }
}

function formatTimeAgo(epoch) {
    const diffSeconds = Math.floor(Date.now() / 1000) - epoch;
    if (diffSeconds < 5) return "Updated just now";
    if (diffSeconds < 60) return `Updated ${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Updated ${diffHours}h ago`;
    const date = new Date(epoch * 1000);
    return `Updated: ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function updateUI(data, shouldScroll = false) {
    if (!data) {
        elements.locationName.textContent = "No Data Available";
        elements.currentCondition.textContent = "Search for a location to begin.";
        // Clear other fields
        [elements.currentDateTime, elements.lastUpdatedDisplay, elements.currentTemperature, elements.feelsLike, elements.wind, elements.humidity, elements.rainToday, elements.pressure, elements.uvIndex, elements.aqiDisplay].forEach(el => el.textContent = '--');
        elements.mainWeatherIcon.innerHTML = '';
        elements.hourlyList.innerHTML = `<p style="padding:10px; color: var(--text-global-secondary);">Weather data unavailable.</p>`;
        elements.dailyGrid.innerHTML = `<p style="padding:10px; color: var(--text-global-secondary); grid-column: 1 / -1;">Weather data unavailable.</p>`;
        return;
    }

    const { location, current, forecast } = data;
    const tempSuffix = currentTemperatureUnit.toUpperCase();
    const currentTemp = currentTemperatureUnit === 'f' ? current.temp_f : current.temp_c;
    const feelsLikeTemp = currentTemperatureUnit === 'f' ? current.feelslike_f : current.feelslike_c;

    elements.locationName.textContent = `${location.name}, ${location.region || location.country}`;
    elements.currentDateTime.textContent = new Date(location.localtime_epoch * 1000).toLocaleString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    elements.lastUpdatedDisplay.textContent = current.last_updated_epoch ? formatTimeAgo(current.last_updated_epoch) : 'Updating...';
    elements.mainWeatherIcon.innerHTML = '';
    elements.mainWeatherIcon.appendChild(createSvgIcon(getMappedWeather(current.condition.code, current.is_day).iconId, current.condition.text));
    elements.currentTemperature.textContent = `${Math.round(currentTemp)}°${tempSuffix}`;
    elements.currentCondition.textContent = current.condition.text;
    elements.feelsLike.textContent = `${Math.round(feelsLikeTemp)}°${tempSuffix}`;
    elements.wind.textContent = `${Math.round(current.wind_mph)} mph ${current.wind_dir}`;
    elements.humidity.textContent = `${current.humidity}%`;
    elements.rainToday.textContent = `${forecast.forecastday[0].day.daily_chance_of_rain}%`;
    elements.pressure.textContent = `${Math.round(current.pressure_mb)} mb`;
    elements.uvIndex.textContent = current.uv;
    
    const aqiData = getAqiMeaning(current.air_quality?.['us-epa-index']);
    elements.aqiDisplay.textContent = aqiData.text;
    elements.aqiDisplay.className = `value ${aqiData.className}`;

    // Hourly Forecast
    elements.hourlyList.innerHTML = '';
    const nowEpoch = Math.floor(Date.now() / 1000);
    const futureHours = forecast.forecastday.flatMap(day => day.hour).filter(hour => hour.time_epoch > nowEpoch);
    futureHours.slice(0, 12).forEach(hour => {
        const hourTemp = currentTemperatureUnit === 'f' ? hour.temp_f : hour.temp_c;
        const hourCard = document.createElement('div');
        hourCard.className = 'hour-card';
        hourCard.setAttribute('role', 'listitem');
        hourCard.innerHTML = `<div class="time">${new Date(hour.time_epoch * 1000).toLocaleTimeString('en-GB', { hour: 'numeric', hour12: true }).toLowerCase()}</div><div class="icon"></div><div class="temp">${Math.round(hourTemp)}°${tempSuffix}</div><div class="pop" aria-label="Chance of rain: ${hour.chance_of_rain}%">💧 ${hour.chance_of_rain}%</div>`;
        hourCard.querySelector('.icon').appendChild(createSvgIcon(getMappedWeather(hour.condition.code, hour.is_day).iconId, hour.condition.text));
        elements.hourlyList.appendChild(hourCard);
    });

    // Daily Forecast
    elements.dailyGrid.innerHTML = '';
    forecast.forecastday.forEach(dayData => {
        const maxTemp = currentTemperatureUnit === 'f' ? dayData.day.maxtemp_f : dayData.day.maxtemp_c;
        const minTemp = currentTemperatureUnit === 'f' ? dayData.day.mintemp_f : dayData.day.mintemp_c;
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.setAttribute('role', 'listitem');
        dayCard.innerHTML = `<div class="day-name">${new Date(dayData.date_epoch * 1000).toLocaleDateString("en-GB", { weekday: "long" })}</div><div class="date">${new Date(dayData.date_epoch * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div><div class="icon"></div><div class="temps"><span class="high">${Math.round(maxTemp)}°</span> / <span class="low">${Math.round(minTemp)}°</span></div><div class="condition-daily">${dayData.day.condition.text}</div>`;
        dayCard.querySelector('.icon').appendChild(createSvgIcon(getMappedWeather(dayData.day.condition.code, 1).iconId, dayData.day.condition.text));
        elements.dailyGrid.appendChild(dayCard);
    });

    if (shouldScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function fetchAutocompleteSuggestions(query) {
    if (query.length < 3) {
        elements.autocompleteSuggestionsContainer.style.display = 'none';
        return;
    }
    const url = `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return;
        const suggestions = await response.json();
        elements.autocompleteSuggestionsContainer.innerHTML = '';
        if (suggestions.length > 0) {
            suggestions.forEach(suggestion => {
                const item = document.createElement('div');
                item.classList.add('suggestion-item');
                item.innerHTML = `${suggestion.name}, ${suggestion.region} <span class="suggestion-region">(${suggestion.country})</span>`;
                item.addEventListener('click', () => {
                    elements.searchInput.value = `${suggestion.name}, ${suggestion.country}`;
                    elements.autocompleteSuggestionsContainer.style.display = 'none';
                    elements.searchClearButton.style.display = 'flex';
                    fetchWeatherData(suggestion.url);
                });
                elements.autocompleteSuggestionsContainer.appendChild(item);
            });
            elements.autocompleteSuggestionsContainer.style.display = 'block';
        } else {
            elements.autocompleteSuggestionsContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Autocomplete fetch error:', error);
    }
}

const debouncedFetchAutocomplete = (query) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchAutocompleteSuggestions(query), 300);
};

function initializeApp() {
    // Event Listeners
    elements.themeToggleButton.addEventListener('click', () => {
        document.body.classList.contains('light-mode') ? setTheme('dark') : setTheme('light');
    });

    elements.unitToggleButton.addEventListener('click', () => {
        currentTemperatureUnit === 'c' ? setTemperatureUnit('f') : setTemperatureUnit('c');
    });

    elements.searchButton.addEventListener('click', () => {
        const query = elements.searchInput.value.trim();
        if (query) fetchWeatherData(query);
        else showError("Please enter a location.", 3000);
        elements.autocompleteSuggestionsContainer.style.display = 'none';
    });

    elements.searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && elements.searchButton.click());
    elements.searchInput.addEventListener('input', () => {
        const query = elements.searchInput.value.trim();
        elements.searchClearButton.style.display = query ? 'flex' : 'none';
        debouncedFetchAutocomplete(query);
    });
    
    elements.searchClearButton.addEventListener('click', () => {
        elements.searchInput.value = '';
        elements.searchInput.focus();
        elements.searchClearButton.style.display = 'none';
        elements.autocompleteSuggestionsContainer.style.display = 'none';
    });

    elements.geolocationButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            showLoading("Finding your location...");
            navigator.geolocation.getCurrentPosition(
                (position) => fetchWeatherData(`${position.coords.latitude},${position.coords.longitude}`),
                (error) => {
                    const messages = {
                        [error.PERMISSION_DENIED]: 'Location permission denied. Please enable it in browser settings.',
                        [error.POSITION_UNAVAILABLE]: 'Location information is currently unavailable.',
                        [error.TIMEOUT]: 'Request to get your location timed out.'
                    };
                    showError(messages[error.code] || 'Could not get your location.');
                },
                { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
            );
        } else {
            showError('Geolocation is not supported by your browser.');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!elements.searchGroup.contains(e.target)) {
            elements.autocompleteSuggestionsContainer.style.display = 'none';
        }
    });

    // Initial Setup
    const savedTheme = localStorage.getItem('weatherwise-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(savedTheme);

    const savedUnit = localStorage.getItem('weatherwise-temp-unit') || 'c';
    setTemperatureUnit(savedUnit);

    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    fetchWeatherData(lastSearchedQuery);
}

initializeApp();