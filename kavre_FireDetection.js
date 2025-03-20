Map.addLayer(aoi)
Map.centerObject(aoi,8)

var points = ee.FeatureCollection([
  ee.Feature(ee.Geometry.Point([85.706985, 27.782070]), {name: "Point 1"}),
  ee.Feature(ee.Geometry.Point([27.796061, 85.687448]), {name: "Point 2"}),
  ee.Feature(ee.Geometry.Point([27.511447, 85.506017]), {name: "Point 3"}),
  ee.Feature(ee.Geometry.Point([27.517266, 85.738874]), {name: "Point 3"})
]);


// Add the point to the map
Map.addLayer(points, {color: 'red'}, 'Location Marker');


// Function to load Sentinel-2 data
function loadSentinel2Data(start, end) {
  return ee
    .ImageCollection("COPERNICUS/S2_SR")
    .filterDate(start, end)
    .filterBounds(aoi)
    .map(cloudMaskS2)
    .map(function (img) {
      return img.clip(aoi);
    })
    .select(["B2", "B3", "B4", "B8", "B11", "B12"]); // Selecting relevant bands
}

// Cloud mask function for Sentinel-2 using MSK_CLDPRB
function cloudMaskS2(image) {
  var cloudProb = image.select("MSK_CLDPRB"); // Cloud Probability Mask
  var mask = cloudProb.lt(5); // Filter pixels with less than 5% cloud probability
  return image.updateMask(mask);
}

// Load pre- and post-wildfire Sentinel-2 imagery
var preFireImagery = loadSentinel2Data("2025-01-01", "2025-01-31").median();
var postFireImagery = loadSentinel2Data("2025-03-01", "2025-03-19").median();

// Add layers to the map
Map.addLayer(preFireImagery, {min: 0, max: 3000, bands: ["B4", "B3", "B2"]}, "Pre-Fire Imagery", true);
Map.addLayer(postFireImagery, {min: 0, max: 3000, bands: ["B4", "B3", "B2"]}, "Post-Fire Imagery", true);

// Function to compute indices
function computeIndex(image, b1, b2, name) {
  return image.normalizedDifference([b1, b2]).rename(name);
}

// Compute NDVI and NBR for before and after the fire
var ndviBefore = computeIndex(preFireImagery, "B8", "B4", "NDVI");
var ndviAfter = computeIndex(postFireImagery, "B8", "B4", "NDVI");
var nbrBefore = computeIndex(preFireImagery, "B8", "B12", "NBR");
var nbrAfter = computeIndex(postFireImagery, "B8", "B12", "NBR");

// Add NDVI layers to the map
Map.addLayer(ndviBefore, {min: -1, max: 1, palette: ['blue', 'white','lightgreen', 'green']}, "NDVI Before", false);
Map.addLayer(ndviAfter, {min: -1, max: 1, palette: ['blue', 'white','lightgreen', 'green']}, "NDVI After", false);

// Compute change in NDVI and NBR
var ndviChange = ndviBefore.subtract(ndviAfter);
var nbrChange = nbrBefore.subtract(nbrAfter);

// Add change detection layers
//Map.addLayer(ndviChange, {min: -1, max: 1, palette: ['red', 'white', 'green']}, "NDVI Change", false);
//Map.addLayer(nbrChange, {min: -1, max: 1, palette: ['red', 'white', 'blue']}, "NBR Change", false);

var waterMask = ee
  .ImageCollection("GOOGLE/DYNAMICWORLD/V1")
  .select("label")
  .mode()
  .neq(0)
  .clip(aoi);
Map.addLayer(waterMask, {}, "water mask", false);

var ndviChangeMasked = ndviChange.updateMask(waterMask);
var nbrChangeMasked = nbrChange.updateMask(waterMask);

Map.addLayer(ndviChange, {}, "NDVI Change", false);
Map.addLayer(nbrChange, {}, "NBR Change", false);
Map.addLayer(nbrChangeMasked, {}, "NBR Change (masked)", false);
Map.addLayer(ndviChangeMasked, {}, "NDVI Change (Masked)", false);
Map.addLayer(nbrchange,nbrchange,"nbr",true)

// 6. Calculate area of change in NDVI and NBR
var ndviAffected = ndviChangeMasked.gt(0.1);
var ndviArea = ndviAffected
  .multiply(ee.Image.pixelArea().divide(1e6))
  .reduceRegion({
    reducer: ee.Reducer.sum(),
    maxPixels: 1e13,
    bestEffort: true,
    geometry: aoi,
    scale: 1000,
  })
  .values()
  .get(0);

print("NDVI Change Extent (sq.km):", ee.Number(ndviArea));

// Calculate burned area extent based on NBR
var burnedThreshold = nbrChange.lt(-0.1).or(nbrChange.gt(0.27));
var burnedArea = burnedThreshold
  .multiply(ee.Image.pixelArea().divide(1e6))
  .reduceRegion({ reducer: ee.Reducer.sum(), geometry: aoi, scale: 500 })
  .values()
  .get(0);

print("Total Burned Area (sq.km):", ee.Number(burnedArea));
// 7. Plot legend
// Define the legend panel
var legend = ui.Panel({
  style: {
    position: "bottom-right",
    padding: "8px 15px",
  },
});

// Title for the legend
var legendTitle = ui.Label({
  value: "Burn Area Index (NBR Change)",
  style: { fontWeight: "bold", fontSize: "14px", margin: "0 0 4px 0" },
});

legend.add(legendTitle);

// Define the color palette
var palette = [
  "#ff0404",
  "#f0ff0c",
  "#46ff0a",
  "#0d6a07",
  "#46ff0a",
  "#f0ff0c",
  "#ff0404",
];

// Define the legend labels (you can adjust based on actual data range)
var labels = ["<-0.03", "-0.02", "-0.01", "0", "0.01", "0.02", ">0.09"];

// Create legend items
for (var i = 0; i < palette.length; i++) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: palette[i],
      padding: "8px",
      margin: "0 4px 4px 0",
    },
  });

  var label = ui.Label({
    value: labels[i],
    style: { margin: "0 0 4px 4px", fontSize: "12px" },
  });

  var legendItem = ui.Panel({
    widgets: [colorBox, label],
    layout: ui.Panel.Layout.Flow("horizontal"),
  });

  legend.add(legendItem);
}

// Add the legend to the map
Map.add(legend);

// Export your map to google drive
// Define export parameters
var exportRegion = aoi.geometry(); // Use your ROI
var exportScale = 30; // Landsat resolution (adjust if needed)

// Export NDVI Change Map
Export.image.toDrive({
  image: ndviChangeMasked, // NDVI change image
  description: "NDVI_Change_Map", // File name in Drive
  folder: "GEE_Exports", // Google Drive folder (optional)
  fileNamePrefix: "NDVI_Change",
  scale: exportScale,
  region: exportRegion,
  crs: "EPSG:4326", // Coordinate Reference System (WGS84)
  maxPixels: 1e13, // Prevents size limit issues
});

// Export NBR Change Map
Export.image.toDrive({
  image: nbrChangeMasked, // NBR change image
  description: "NBR_Change_Map", // File name in Drive
  folder: "GEE_Exports", // Google Drive folder (optional)
  fileNamePrefix: "NBR_Change",
  scale: exportScale,
  region: exportRegion,
  crs: "EPSG:4326",
  maxPixels: 1e13,
});
