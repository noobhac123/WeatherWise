// js/main.js

const apiKey = 'a3af77f2f03f42cbbe335101250306';
const daysForecast = 10;
const defaultLocation = 'Yeovil';

// DOM Elements
const heroSection = document.querySelector('.hero'); 
const locationInput = document.getElementById('locationInput');
const searchButton = document.getElementById('searchButton');
const searchInputError = document.getElementById('searchInputError'); 
const unitToggleBtn = document.getElementById('unitToggleBtn'); 
const geolocationBtn = document.getElementById('geolocationBtn'); 

const weatherResultsArea = document.querySelector('.weather-results-area');
const locationHeaderElement = document.getElementById('locationHeader');
const forecastHeaderElem = document.getElementById('forecastHeader');
const currentWeatherCard = document.getElementById('currentWeatherCard');
const hourlyForecastContainer = document.getElementById('hourlyForecastContainer');
const forecastGrid = document.getElementById('forecastGrid');
const statusMessageContainer = document.getElementById('statusMessageContainer'); 
const currentYearSpan = document.getElementById('currentYear');

let searchErrorTimeoutId = null;
let lastSuccessfulLocationData = null; 
let currentTemperatureUnit = 'celsius'; 

// --- INITIALIZATION ---
if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
}
loadPreferredUnit();


// --- PARALLAX SCROLL EFFECT ---
function handleParallax() {
    if (heroSection) {
        const scrollPosition = window.pageYOffset;
        heroSection.style.backgroundPositionY = scrollPosition * 0.3 + 'px';
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    fetchWeather(defaultLocation); 
    window.addEventListener('scroll', () => {
        requestAnimationFrame(handleParallax);
    });
    handleParallax(); 
});

if (searchButton) {
    searchButton.addEventListener('click', handleSearch);
}
if (locationInput) {
    locationInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') handleSearch();
    });
    locationInput.addEventListener('input', () => {
        if (searchInputError && searchInputError.classList.contains('visible')) {
            searchInputError.classList.remove('visible');
            if (searchErrorTimeoutId) { clearTimeout(searchErrorTimeoutId); searchErrorTimeoutId = null; }
        }
    });
}
if (unitToggleBtn) {
    unitToggleBtn.addEventListener('click', toggleTemperatureUnit);
}
if (geolocationBtn) {
    geolocationBtn.addEventListener('click', handleGeolocation);
}

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            const headerOffset = document.querySelector('header').offsetHeight || 70;
            const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    });
});

// --- CORE FUNCTIONS ---
function handleSearch() {
    const query = locationInput.value.trim();
    if (query) {
        if (searchInputError && searchInputError.classList.contains('visible')) {
            searchInputError.classList.remove('visible');
            if (searchErrorTimeoutId) { clearTimeout(searchErrorTimeoutId); searchErrorTimeoutId = null; }
        }
        fetchWeather(query);
    } else {
        displaySearchInputError("Please enter a city name to search.");
    }
}

function displaySearchInputError(message, duration = 1000) { 
    if (!searchInputError) return;
    searchInputError.textContent = message;
    searchInputError.classList.add('visible');
    if (searchErrorTimeoutId) { clearTimeout(searchErrorTimeoutId); }
    searchErrorTimeoutId = setTimeout(() => {
        searchInputError.classList.remove('visible');
        searchErrorTimeoutId = null;
    }, duration);
}

function showCriticalStatusMessage(message) { 
    if (statusMessageContainer) {
        statusMessageContainer.style.display = 'block';
        statusMessageContainer.innerHTML = `<p class="error-message">${message}</p>`;
    }
    if (weatherResultsArea) {
        weatherResultsArea.classList.remove('visible'); 
    }
    lastSuccessfulLocationData = null; 
}

function loadPreferredUnit() {
    const savedUnit = localStorage.getItem('weatherUnit');
    currentTemperatureUnit = (savedUnit === 'fahrenheit') ? 'fahrenheit' : 'celsius';
    updateUnitToggleButton();
}

function toggleTemperatureUnit() {
    currentTemperatureUnit = (currentTemperatureUnit === 'celsius') ? 'fahrenheit' : 'celsius';
    localStorage.setItem('weatherUnit', currentTemperatureUnit);
    updateUnitToggleButton();
    if (lastSuccessfulLocationData) {
        displayCurrentWeather(lastSuccessfulLocationData.current, lastSuccessfulLocationData.location.name, lastSuccessfulLocationData.location.country);
        displayHourlyForecast(lastSuccessfulLocationData.forecast.forecastday[0].hour);
        displayForecast(lastSuccessfulLocationData.forecast.forecastday, lastSuccessfulLocationData.location.name);
    }
}

function updateUnitToggleButton() {
    if (unitToggleBtn) {
        unitToggleBtn.textContent = (currentTemperatureUnit === 'celsius') ? '°C' : '°F';
    }
}

function getTemperature(tempDataC, tempDataF) {
    if (!tempDataC && !tempDataF) return 'N/A'; // Handle missing temp data
    if (currentTemperatureUnit === 'fahrenheit') {
        return tempDataF !== undefined ? Math.round(tempDataF) + '°F' : Math.round(tempDataC * 9/5 + 32) + '°F'; // Fallback conversion
    }
    return tempDataC !== undefined ? Math.round(tempDataC) + '°C' : Math.round((tempDataF - 32) * 5/9) + '°C'; // Fallback conversion
}

async function handleGeolocation() { 
    if (!navigator.geolocation) {
        displaySearchInputError("Geolocation is not supported by your browser.", 3000);
        return;
    }

    if (!geolocationBtn) return; 

    geolocationBtn.disabled = true;
    geolocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding...';
    if (searchInputError && searchInputError.classList.contains('visible')) {
        searchInputError.classList.remove('visible');
        if (searchErrorTimeoutId) { clearTimeout(searchErrorTimeoutId); searchErrorTimeoutId = null; }
    }

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, 
                timeout: 25000,         
                maximumAge: 0           
            });
        });

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const locationQuery = `${lat},${lon}`;
        
        if(locationInput) locationInput.value = `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
        
        await fetchWeather(locationQuery); 

    } catch (error) {
        let geoErrorMessage = "Could not get your location. ";
        if (error.code) { 
            switch (error.code) {
                case error.PERMISSION_DENIED: geoErrorMessage += "Permission denied."; break;
                case error.POSITION_UNAVAILABLE: geoErrorMessage += "Location unavailable. Ensure GPS is on."; break;
                case error.TIMEOUT: geoErrorMessage += "Request timed out. Try again in an open area with good network/GPS signal."; break;
                default: geoErrorMessage += "An unknown error occurred while getting location."; break;
            }
        } else { 
            geoErrorMessage += error.message || "An unknown error occurred.";
        }
        displaySearchInputError(geoErrorMessage, 5000); 
        console.error("Geolocation or subsequent Fetch error: ", error);
    } finally {
        if (geolocationBtn) { 
            geolocationBtn.disabled = false;
            geolocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Use My Current Location';
        }
    }
}

function displayLoading(forLocation, preserveContent = false) {
    if (statusMessageContainer) statusMessageContainer.style.display = 'none';
    if (searchInputError && searchInputError.classList.contains('visible')) {
         searchInputError.classList.remove('visible');
         if (searchErrorTimeoutId) { clearTimeout(searchErrorTimeoutId); searchErrorTimeoutId = null;}
    }
    const loaderHTML = '<div class="loader-container"><div class="loader"></div></div>';
    const hourlyLoaderHTML = '<div class="loader-container hourly-loader-placeholder"><div class="loader"></div></div>';
    
    if (weatherResultsArea && !weatherResultsArea.classList.contains('visible') && !preserveContent) {
        requestAnimationFrame(() => { setTimeout(() => { if(weatherResultsArea) weatherResultsArea.classList.add('visible'); }, 50); });
    }

    if (locationHeaderElement) { locationHeaderElement.innerHTML = `<h2>Loading weather for ${forLocation}...</h2>`; }

    if (!preserveContent) { 
        if (currentWeatherCard) { currentWeatherCard.classList.remove('content-visible'); currentWeatherCard.innerHTML = loaderHTML; }
        if (forecastGrid) { 
            const existingCards = forecastGrid.querySelectorAll('.forecast-card'); // Clear existing cards before loader
            existingCards.forEach(card => card.remove());
            forecastGrid.innerHTML = loaderHTML; 
        }
        if (hourlyForecastContainer) { hourlyForecastContainer.innerHTML = hourlyLoaderHTML; }
    } else {
        // If preserving content, only hourly loader might be needed if it's specifically being updated
        // and main current/forecast loaders are not shown over existing preserved content.
        // However, the location header IS updated to "Loading..." which might be confusing if content below doesn't change.
        // For now, let's also put a loader in hourly if preserving.
        if (hourlyForecastContainer) { hourlyForecastContainer.innerHTML = hourlyLoaderHTML; }
    }
}

function formatDate(dateString, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    return localDate.toLocaleDateString('en-GB', options);
}

function displayCurrentWeather(currentData, locationName, country) {
    if (!currentWeatherCard) return;
    currentWeatherCard.classList.remove('content-visible');
    currentWeatherCard.innerHTML = ''; 
    if (!currentData || !currentData.condition) { currentWeatherCard.innerHTML = '<p class="error-message">Current data unavailable or incomplete.</p>'; return; }
    if (locationHeaderElement) { locationHeaderElement.innerHTML = `<h2>Weather in ${locationName}, ${country}</h2>`; }
    let icon = currentData.condition.icon.startsWith('//') ? 'https:' + currentData.condition.icon : currentData.condition.icon;
    currentWeatherCard.innerHTML = `
        <div class="weather-icon-temp">
            <img src="${icon}" alt="${currentData.condition.text}" class="current-icon">
            <p class="current-temperature">${getTemperature(currentData.temp_c, currentData.temp_f)}</p>
            <p class="current-condition">${currentData.condition.text}</p>
        </div>
        <div class="current-details-grid">
            <p><strong>Feels like:</strong> ${getTemperature(currentData.feelslike_c, currentData.feelslike_f)}</p>
            <p><strong>Humidity:</strong> ${currentData.humidity}%</p>
            <p><strong>Wind:</strong> ${currentData.wind_kph} kph ${currentData.wind_dir}</p>
            <p><strong>Pressure:</strong> ${currentData.pressure_mb} mb</p>
            <p><strong>Visibility:</strong> ${currentData.vis_km} km</p><p><strong>UV Index:</strong> ${currentData.uv}</p>
            <p><strong>Precipitation:</strong> ${currentData.precip_mm} mm</p>
            <p><strong>Last Updated:</strong> ${currentData.last_updated.split(" ")[1]}</p> 
        </div>`;
    requestAnimationFrame(() => { setTimeout(() => { currentWeatherCard.classList.add('content-visible'); }, 50); });
}

function displayHourlyForecast(hourlyData) {
    if (!hourlyForecastContainer) return;
    hourlyForecastContainer.innerHTML = ''; 
    if (!hourlyData || hourlyData.length === 0) { hourlyForecastContainer.innerHTML = '<p class="error-message" style="text-align:left; padding:0 var(--padding-sm);">Hourly data unavailable.</p>'; return; }
    const now = new Date(); const currentHour = now.getHours();
    const relevantHours = hourlyData.filter(h => {
        const hourDate = new Date(h.time_epoch * 1000);
        return hourDate.getDate() === now.getDate() && hourDate.getHours() >= currentHour;
    });
    if (relevantHours.length === 0) { hourlyForecastContainer.innerHTML = '<p style="text-align:left; padding:0 var(--padding-sm);">No more hourly data for today.</p>'; return; }
    relevantHours.forEach((hour, index) => {
        if (!hour.condition) return; // Skip if hour.condition is missing
        let icon = hour.condition.icon.startsWith('//') ? 'https:' + hour.condition.icon : hour.condition.icon;
        const card = document.createElement('div'); card.className = 'hourly-card';
        card.innerHTML = `
            <p class="time">${new Date(hour.time_epoch * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
            <img src="${icon}" alt="${hour.condition.text}" class="condition-icon">
            <p class="temp">${getTemperature(hour.temp_c, hour.temp_f)}</p>
            ${hour.chance_of_rain > 0 ? `<p class="chance-of-rain">${hour.chance_of_rain}% rain</p>` : ''}`;
        hourlyForecastContainer.appendChild(card);
        requestAnimationFrame(() => { setTimeout(() => { card.classList.add('visible'); }, index * 75); });
    });
}

function displayForecast(forecastDays, locationName) {
    if (!forecastGrid || !forecastHeaderElem) return;
    forecastGrid.innerHTML = ''; 
    forecastHeaderElem.textContent = `${daysForecast}-Day Forecast for ${locationName}`;
    if (!forecastDays || forecastDays.length === 0) { forecastGrid.innerHTML = '<p class="error-message" style="grid-column:1/-1">Forecast data unavailable.</p>'; return; }
    forecastDays.forEach((dayData, index) => {
        if (!dayData.day || !dayData.day.condition) return; // Skip if day or day.condition is missing
        let icon = dayData.day.condition.icon.startsWith('//') ? 'https:' + dayData.day.condition.icon : dayData.day.condition.icon;
        const card = document.createElement('div'); card.className = 'forecast-card';
        card.innerHTML = `
            <p class="date">${formatDate(dayData.date)}</p>
            <img src="${icon}" alt="${dayData.day.condition.text}" class="forecast-icon">
            <p class="temperature">${getTemperature(dayData.day.avgtemp_c, dayData.day.avgtemp_f)}</p>
            <p class="condition">${dayData.day.condition.text}</p>
            <p class="min-max">Min: ${getTemperature(dayData.day.mintemp_c, dayData.day.mintemp_f)} / Max: ${getTemperature(dayData.day.maxtemp_c, dayData.day.maxtemp_f)}</p>`;
        forecastGrid.appendChild(card);
        requestAnimationFrame(() => { setTimeout(() => { card.classList.add('visible'); }, index * 100); });
    });
}

async function fetchWeather(locationQuery) {
    const isDefaultSearch = locationQuery.toLowerCase() === defaultLocation.toLowerCase();
    
    // Determine if content should be preserved based on if default is showing and it's a non-default search
    const preserveContentFlag = !isDefaultSearch && 
                                weatherResultsArea && 
                                weatherResultsArea.classList.contains('visible') &&
                                lastSuccessfulLocationData && // Ensure there's something to preserve
                                lastSuccessfulLocationData.location.name.toLowerCase() === defaultLocation.toLowerCase();


    if (preserveContentFlag) { 
        displayLoading(locationQuery, true); // True to preserve (mostly, only updates header and hourly loader)
    } else {
        // If not preserving, or if it's default search, handle transitions and loading normally
        if (weatherResultsArea && weatherResultsArea.classList.contains('visible')) {
             // Only transition out if it's a new search that's NOT default, to avoid Yeovil transitioning out on initial load
            if(!isDefaultSearch) {
                weatherResultsArea.classList.remove('visible');
                await new Promise(resolve => setTimeout(resolve, 400)); 
            } else {
                 weatherResultsArea.classList.remove('visible'); // Hide immediately for default load
            }
        } else if (weatherResultsArea) { 
            weatherResultsArea.classList.remove('visible'); // Ensure it's hidden if not preserving
        }
        displayLoading(locationQuery, false); // False to show full loaders
    }

    const apiUrl = `https://api.weatherapi.com/v1/forecast.json?q=${encodeURIComponent(locationQuery)}&days=${daysForecast}&key=${apiKey}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.error) { 
            let errorMessage = data.error.message;
            if (data.error.code === 1006) { // No matching location
                displaySearchInputError(`No location found for "${locationQuery}". Check spelling.`); 
                
                if (isDefaultSearch) { // Default location itself not found
                    if(weatherResultsArea) weatherResultsArea.classList.remove('visible'); 
                    showCriticalStatusMessage(`Could not load weather for default location (${defaultLocation}): ${errorMessage}`);
                } else if (lastSuccessfulLocationData) {
                    // A user search failed, but we have previous (Yeovil) data. Restore it.
                    // This also means the "Loading for [searched city]..." in header needs to revert.
                    displayCurrentWeather(lastSuccessfulLocationData.current, lastSuccessfulLocationData.location.name, lastSuccessfulLocationData.location.country);
                    displayHourlyForecast(lastSuccessfulLocationData.forecast.forecastday[0].hour);
                    displayForecast(lastSuccessfulLocationData.forecast.forecastday, lastSuccessfulLocationData.location.name);
                    // Ensure the results area is visible if it was hidden by preserveContent logic or loader
                    if (weatherResultsArea && !weatherResultsArea.classList.contains('visible')) {
                         requestAnimationFrame(() => weatherResultsArea.classList.add('visible'));
                    }
                }
                // If no lastSuccessfulLocationData, loaders put by displayLoading(false) will remain.
                return; 
            } else { // Other API errors
                throw new Error(errorMessage);
            }
        }
        
        if (!response.ok) { throw new Error(`API Error: ${response.status} ${response.statusText}.`); }
        
        // SUCCESS
        lastSuccessfulLocationData = data; 
        if (statusMessageContainer) statusMessageContainer.style.display = 'none'; 
        
        const locationName = data.location.name;
        const country = data.location.country;
        
        // If content was preserved, we might have shown minimal loaders.
        // Now, clear properly and show new data.
        if (preserveContentFlag) {
            if (currentWeatherCard) { currentWeatherCard.classList.remove('content-visible'); currentWeatherCard.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';}
            if (forecastGrid) { forecastGrid.innerHTML = '<div class="loader-container"><div class="loader"></div></div>'; }
            if (hourlyForecastContainer) { hourlyForecastContainer.innerHTML = '<div class="loader-container hourly-loader-placeholder"><div class="loader"></div></div>'; }
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }

        displayCurrentWeather(data.current, locationName, country);
        displayHourlyForecast(data.forecast.forecastday[0].hour);
        displayForecast(data.forecast.forecastday, locationName); 
        
        if (weatherResultsArea && !weatherResultsArea.classList.contains('visible')) { 
            requestAnimationFrame(() => { weatherResultsArea.classList.add('visible'); });
        }
        
        if (!isDefaultSearch) { 
            const resultsTarget = document.getElementById('weather-results-target');
            if (resultsTarget) {
                setTimeout(() => {
                    const headerOffset = document.querySelector('header').offsetHeight || 70;
                    const elementPosition = resultsTarget.getBoundingClientRect().top + window.pageYOffset;
                    const offsetPosition = elementPosition - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }, 100); 
            }
        }

    } catch (error) { 
        console.error(`Failed to fetch weather data for ${locationQuery}:`, error);
        showCriticalStatusMessage(error.message); 
        if (weatherResultsArea) weatherResultsArea.classList.remove('visible');
    } finally {
        if (geolocationBtn && geolocationBtn.disabled) {
            geolocationBtn.disabled = false;
            geolocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Use My Current Location';
        }
    }
}