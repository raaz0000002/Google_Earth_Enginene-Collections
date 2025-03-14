Map.addLayer(aoi, {}, 'AOI');
Map.centerObject(aoi, 7);

// Function to get the night lights image for a given year
function getNightLights(year) {
  year = ee.Number(year);
  var startDate = ee.Date.fromYMD(year, 1, 1);
  var endDate = ee.Date.fromYMD(year.add(1), 1, 1);
  
  var collection = ee.ImageCollection("NOAA/DMSP-OLS/NIGHTTIME_LIGHTS")
    .filterDate(startDate, endDate);
  
  var count = collection.size(); // Get the number of images in the collection
  
  var img = ee.Algorithms.If(
    count.gt(0), // If there is data, process it
    collection.median().select("avg_vis").clip(aoi).set("year", year),
    null
  );
  
  return img;
}

// Generate images for each year from 1992 to 2014
var years = ee.List.sequence(1992, 2014);
var images = years.map(getNightLights);

print("Years:", years);
print("Night Lights Images:", images);

// Remove null values from the list
var validImages = images.removeAll([null]);

print("Valid Night Lights Images:", validImages);

// Convert to ImageCollection
var imageCollection = ee.ImageCollection(validImages);
print("Final Image Collection:", imageCollection);

// Visualization parameters
var VisParams = {
  min: 0,
  max: 60,
  palette: ["black", "yellow", "orange", "red", "cyan", "blue", "purple"]
};

// Add first image from the collection for visualization
Map.addLayer(imageCollection.first(), VisParams, "Year 1992");

var bbox = aoi.geometry().simplify(1000).buffer(30000)
print(bbox, "gif map")

// Create images for GIF
var gifImages = imageCollection.map(function (img) {
  return img.visualize(VisParams).clip(aoi);
});

// GIF export parameters
var gifParams = { 
  dimensions: 500,  // Fixed incorrect key
  region: bbox,  // Use bbox as region
  framesPerSecond: 1,
  crs: "EPSG:4326",
  format: "gif"
};

// Display GIF thumbnail
print(ui.Thumbnail(gifImages, gifParams));


print(require("users/gena/packages:text"));



// ANNOTATION TEXT

var text = require("users/gena/packages:text");  //<--- IMPORTING THIRD PARTY LIBRARY.
var annotations = [
{
position: "right",
offset: "1%",
margin: "1%",
property: "label",
scale: Map.getScale() * 2,
},
];



var position = ee.Geometry.Point([80.0, 26.8]); 

function addText(image) {
  var timeStamp = image.get("year"); // Get the timestamp of each frame
  
  var img = image.visualize({  // Convert each frame to RGB explicitly since it is a 1-band image
    forceRgbOutput: true, 
    min: 0.0,
    max: 60.0,
    palette: ["black", "red", "orange", "yellow", "white"],
  }).set({ label: ee.String(timeStamp).slice(0, 4) });  
  
  var annotated = text.annotateImage(img, {}, position, annotations);  
  return annotated; 
}

var tempCol = imageCollection.map(addText);

// Get GIF URL
print(tempCol.getVideoThumbURL(gifParams));

// Display GIF thumbnail
print(ui.Thumbnail(tempCol, gifParams));


/*--------------------------------------------
overlay Nepal layer
--------------------------------------------*/


// Define an empty image to paint features to.
var empty = ee. Image().byte();
var nepaloutline = empty
.paint({ featureCollection: aoi, color: 1, width: 1 })
 .visualize({ palette: "white" });


 var tempColOutline = tempCol.map(function (img) {
   return img.blend(nepaloutline);
});
// Display the animation.
print(ui.Thumbnail(tempColOutline, gifParams));

/*=======================
hill shade
===========================*/
// Load SRTM data and compute hillshade
var hillshade = ee.Terrain.hillshade(
  ee.Image("USGS/SRTMGL1_003")
    .multiply(100) // Exaggerate elevation for contrast
    .clip(aoi) // Corrected from `clipToCollection(aoi)` to `clip(aoi)`
);

// Blend hillshade with the image collection
var finalVisCol = tempColOutline.map(function (img) {
  return hillshade.blend(img.visualize({ opacity: 0.6 })); 
});

// Get the URL to download the video
print(finalVisCol.getVideoThumbURL(gifParams)); // Fixed typo: `getVidedThumbURL` → `getVideoThumbURL`

// Display the animation
print(ui.Thumbnail(finalVisCol, gifParams)); // Removed extra space in `ui.Thumbnail`
