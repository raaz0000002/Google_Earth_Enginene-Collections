Map.addLayer(roi)
Map.centerObject(roi,8.5)
Map.addLayer(landslide_scars)

Map.addLayer(landslide_scars, null, "LS_scars");

//adding the mde
var dataset = ee.Image("NASA/NASADEM_HGT/001").clip(roi);
var elevation = dataset.select("elevation").reproject("EPSG:4326", null, 30);

//creation samples of occurence
var occurence = elevation
  .sampleRegions(landslide_scars, [], 30, "EPSG:4326", 1, true)
  .map(function (f) {
    return f.set("class", 1);
  })
  .filterBounds(roi);
  
var occurence = occurence.select("class");

//creating a 60m buffer around the scars
var buffer_size_60 = 60;

//creating the function
var buffer_60_function = function (feature) {
  return feature.buffer(buffer_size_60);
};

//creating the buffer
var buffer_60 = landslide_scars.map(buffer_60_function);
//Map.addLayer(buffer_60, null, 'buffer_60')

//Creating a 5000m buffer around the scars
var buffer_size_5000 = 5000;

//creating the function
var buffer_5000_function = function (feature) {
  return feature.buffer(buffer_size_5000);
};

//creating the buffer
var buffer_5000 = landslide_scars.map(buffer_5000_function);
//Map.addLayer(buffer_2, null, 'buffer_5000')

//selecting areas with slope great than x° in the roi
//areas with less than defined slope will be excluded from the sampling
//Slope from SRTM
var slope = ee.Terrain.slope(elevation).reproject("EPSG:4326", null, 30);
//Map.addLayer(slope, null, 'Slope')

//define the slope limit for masking
var slope_lte = slope.mask(slope.gte(10)).int();
//Map.addLayer(slope_lte)

//creation samples of non occurence - method i
var non_occurence_i = ee.FeatureCollection.randomPoints(roi, 50).map(function (
  f
) {
  return f.set("class", 0);
});

//disregarded the samples allocated in the buffer 1
var non_occurence_i = non_occurence_i.filter(ee.Filter.bounds(buffer_60).not());
// Map.addLayer(non_occurence_i, {}, "non_occurence_i")

//creation samples of non occurence - method ii
var non_occurence_ii = ee.Image.random()
  .updateMask(slope_lte)
  .int()
  .stratifiedSample({
    numPoints: 50,
    region: roi,
    scale: 30,
    geometries: true,
  })
  .map(function (f) {
    return f.set("class", 0);
  });

//disregarded the samples allocated in the buffer 1 an slope < 10°
var non_occurence_ii = non_occurence_ii.filter(
  ee.Filter.bounds(buffer_60).not()
);
// Map.addLayer(non_occurence_ii, {}, "non_occurence_ii")

//creation samples of non occurence - method iii
var non_occurence_iii = ee.FeatureCollection.randomPoints(buffer_5000, 50)
  .map(function (f) {
    return f.set("class", 0);
  })
  .filterBounds(roi);

//disregarded the samples allocated in the buffer 1
var non_occurence_iii = non_occurence_iii.filter(
  ee.Filter.bounds(buffer_60).not()
);
// Map.addLayer(non_occurence_iii, {}, "non_occurence_iii")

//creation samples of non occurence - method iiii
var non_occurence_iiii = ee.Image.random()
  .updateMask(slope_lte)
  .int()
  .stratifiedSample({
    numPoints: 50,
    region: roi,
    scale: 30,
    geometries: true,
  })
  .map(function (f) {
    return f.set("class", 0);
  })
  .filterBounds(buffer_5000);

//disregarded the samples allocated in the buffer 1 an slope < 10°
var non_occurence_iiii = non_occurence_iiii.filter(
  ee.Filter.bounds(buffer_60).not()
);
// Map.addLayer(non_occurence_iiii, {}, 'non_occurence_iiii')

//Method i = non_occurence_i; Method ii = non_occurence_ii
//Method iii = non_occurence_iii; Method iiii = non_occurence_iiii
var samples_group = occurence.merge(non_occurence_i);

//Elevation from SRTM
var dataset = ee.Image("NASA/NASADEM_HGT/001").clip(roi);
var elevation = dataset.select("elevation");
var elevation = elevation.reproject("EPSG:4326", null, 30);
//Map.addLayer(elevation, null, 'Elevation')

//Slope from SRTM
var slope = ee.Terrain.slope(elevation);
var slope = slope.reproject("EPSG:4326", null, 30).rename("SLP");
//Map.addLayer(slope, null, 'Slope')

var slope_samples = slope.reduceRegions(samples_group, ee.Reducer.mean());

//Aspect from SRTM
var aspect = ee.Terrain.aspect(elevation);
var aspect = aspect.reproject("EPSG:4326", null, 30).rename("ASP");
//Map.addLayer(aspect,null, 'Aspect')

//HillShade from SRTM
var hillshade = ee.Terrain.hillshade(elevation, 90, 45).rename("HLSH");
var hillshade = hillshade.reproject("EPSG:4326", null, 30);
//Map.addLayer(hillshade, null, 'Hilshade')

var buffer_size_500 = 500;

//creating the function
var buffer_500_function = function (feature) {
  return feature.buffer(buffer_size_500);
};

//creating the buffer
var roi_extend = roi.map(buffer_500_function);
//Map.addLayer(buffer_500, null, 'buffer_500')

//Extend elevation from SRTM
var dataset_extend = ee.Image("NASA/NASADEM_HGT/001").clip(roi_extend);
var elevation_extend = dataset_extend.select("elevation");

//Flow Accumulation
var flowaccumulation = ee
  .Image("MERIT/Hydro/v1_0_1")
  .select("upa")
  .log()
  .clip(roi);
var flowaccumulation = flowaccumulation
  .reproject("EPSG:4326", null, 30)
  .rename("FWACC");
Map.addLayer(flowaccumulation, null, "Flow Accumulation", false);

//Global Height Above the Nearest Drainage
var hand = ee
  .Image("users/gena/GlobalHAND/30m/hand-1000")
  .clip(roi)
  .rename("HAND");
var hand = hand.reproject("EPSG:4326", null, 30);
// Map.addLayer(hand, null, 'HAND', false)

//variables generated from the processing of other products

//topographic position index
var meanTPI = elevation_extend.focalMean(5, "square");
var tpi = elevation_extend
  .subtract(meanTPI)
  .reproject("EPSG:4326", null, 30)
  .rename("mTPI")
  .clip(roi);
// Map.addLayer(tpi, null, 'TPI', false);

//horizontal distance to channel network
//selecting pixels with drainage area greater than 0.5km²
var rivers = ee.Image("MERIT/Hydro/v1_0_1").select("upa").clip(roi).gt(0.5);
//Map.addLayer(rivers)

//euclidean Distance.
var maxDistM = 7500;

//calculate distance to target pixels
var euclideanKernel = ee.Kernel.euclidean(maxDistM, "meters");
var visParamsEuclideanDist = { min: 0, max: maxDistM };

//applying the Euclidean distance function
var hdtp = rivers.distance(euclideanKernel);
var hdtp = hdtp.reproject("EPSG:4326", null, 30).rename("HDND");
//Map.addLayer(hdtp, visParamsEuclideanDist, 'HDTP');

//creating a data cube with the variables listed
var cubedata = slope
  .addBands(aspect)
  .addBands(hillshade)
  .addBands(hand)
  .addBands(flowaccumulation)
  .addBands(tpi)
  .addBands(hdtp)
  .addBands(elevation);
  
print(cubedata,"cubedata")

/********************************training and classification*************************************/
//in this step, using samples and explanatory variables, the Random Forest classifier
//generates a landslide susceptibility model

//extract the values from the input data for each sample training
var samples_values = cubedata.reduceRegions(samples_group, ee.Reducer.mean());

//define the name of the variables used in training
var bandNames = cubedata.bandNames();
print(bandNames, "band useds in training");

//filter out null values from the training feature collection
var samples_dataset = samples_values.randomColumn("random");

var samples_no_nulls = samples_dataset.filter(
  ee.Filter.notNull(samples_dataset.first().propertyNames())
);

//dividing the samples for training and accuracy evaluation
var training = samples_no_nulls.filter(ee.Filter.lte("random", 0.7));
var acurracy_evaluation = samples_no_nulls.filter(ee.Filter.gt("random", 0.7));

//random forest
var rf = ee.Classifier.smileRandomForest(100)
  .train(training, "class", bandNames)
  .setOutputMode("PROBABILITY");

//probability mapping
var rfclass = cubedata.select(bandNames).classify(rf);

//set the desired area to extrapolate the classification
//it is recommended that the extrapolation area be the same as that used to delimit the classification samples,
//ignoring only the restriction related to landslide scars.
//method i = .clip(roi); method ii = .updateMask(slope_lte)
//method iii = .clip(buffer_5000); method iiii = .updateMask(slope_lte).clip(buffer_5000)
var rfclass = rfclass.clip(roi);

//Export image to drive
Export.image.toDrive({
  image: rfclass,
  description: "susceptibility_model",
  folder: "model_sp",
  region: roi,
  scale: 30,
  crs: "EPSG:4326",
  maxPixels: 1e13,
});

// Visualization parameter
var viz = { min: 0, max: 1, palette: ["green", "yellow", "red"] };
Map.addLayer(rfclass, viz, "RF");

//Important factor of variables to the classification
var rf_dict = rf.explain();
print("Explain:", rf_dict);

var rf_variable_importance = ee.Feature(
  null,
  ee.Dictionary(rf_dict).get("importance")
);

//Important factor in % of variables to the classification
var importance = ee.Dictionary(rf.explain().get("importance"));
var totalImportance = importance.values().reduce(ee.Reducer.sum());
var importancePercentage = importance.map(function (band, importance) {
  return ee.Number(importance).divide(totalImportance).multiply(100);
});
//print(importancePercentage);

var importance_percentage_geometry = ee.Feature(null, importancePercentage);

//print the importance of variables in a graph
var rf_percentage_chart = ui.Chart.feature
  .byProperty({ features: importance_percentage_geometry })
  .setChartType("BarChart")
  .setOptions({
    title: "Importance of variables in Random Forest classification (%)",
    legend: { position: "none" },
    vAxis: {
      title: "Variables",
      titleTextStyle: { italic: false, bold: false },
    },
    hAxis: {
      title: "Importance in %",
      fontName: "times new roman",
      titleTextStyle: { italic: false, bold: false },
    },
    colors: ["silver"],
    viewWindow: { min: 0, max: 12 },
    fontName: "times new roman",
    fontSize: 40,
  });
print(rf_percentage_chart);

/********************************Box Plot *************************************/
//statistical evaluation of occurrence and non-occurrence samples
// At this stage, a box plot is generated to characterize the occurrence and non-occurrence samples
//in relation to the variables listed. This stage is important for evaluating the explanatory capacity
//of the variables, helping to decide which ones to use.
// 0 = non-occurence; 1 = occurence

var Names = ee.List(["Non-occurrence", "Occurrence"]);

function showBoxPlot(samples_no_nulls, bands) {
  var dataTable = {
    cols: [
      { id: "x", type: "string" },
      { id: "series0", type: "number" }, // dummy series
      { id: "min", type: "number", role: "interval" },
      { id: "max", type: "number", role: "interval" },
      { id: "firstQuartile", type: "number", role: "interval" },
      { id: "median", type: "number", role: "interval" },
      { id: "thirdQuartile", type: "number", role: "interval" },
    ],
  };

  var values = Names.map(function (c) {
    var index = Names.indexOf(c);
    var v = samples_no_nulls
      .filter(ee.Filter.eq("class", index))
      .aggregate_array(bands);
    var min = v.reduce(ee.Reducer.min());
    var max = v.reduce(ee.Reducer.max());
    var p25 = v.reduce(ee.Reducer.percentile([25]));
    var p50 = v.reduce(ee.Reducer.percentile([50]));
    var p75 = v.reduce(ee.Reducer.percentile([75]));

    return [c, 0, min, max, p25, p50, p75];
  });

  values.evaluate(function (values) {
    dataTable.rows = values.map(function (row) {
      return {
        c: row.map(function (o) {
          return { v: o };
        }),
      };
    });

    var options = {
      title: "Box Plot " + bands,
      height: 500,
      legend: { position: "none" },
      hAxis: {
        gridlines: { color: "black" },
      },
      lineWidth: 0,
      series: [{ color: "gray" }],
      intervals: {
        barWidth: 0.5,
        boxWidth: 0.5,
        lineWidth: 3,
        style: "boxes",
      },
      interval: {
        min: {
          style: "bars",
          color: "black",
        },
        max: {
          style: "bars",
          color: "black",
        },
      },
    };
    print(ui.Chart(dataTable, "LineChart", options));
  });
}

//the variable analyzed by box plot can be changed by changing the name inside the quotation marks ''
//The name of the variables used in the training is available on the console in the tab called 'Bands used in training'
showBoxPlot(samples_no_nulls, "FWACC");

/***************************************sample histogram******************************************/
//analyzing the histogram of the input variables for the occurrence and non-occurrence samples

//selecting the occurrence samples
var ocurrence_sample = samples_no_nulls.filter(ee.Filter.eq("class", 1));
print(ocurrence_sample);

//generating a histogram for the occurrence samples
var ocurence_histogram = ui.Chart.feature
  .histogram({
    features: ocurrence_sample,
    property: "FWACC",
    minBucketWidth: 1,
  })
  .setOptions({
    title: "Histogram of occurance sample in a variable",
    hAxis: {
      title: "Variable X",
      titleTextStyle: { color: "black", italic: false, bold: true },
    },
    vAxis: {
      title: "Pixel count",
      titleTextStyle: { color: "black", italic: false, bold: true },
    },
    colors: ["red"],
    legend: { position: "none" },
  });
print(ocurence_histogram);

//selecting the non occurrence samples
var non_ocurrence_sample = samples_no_nulls.filter(ee.Filter.eq("class", 0));

//generating a histogram for the occurrence samples
var non_ocurence_histogram = ui.Chart.feature
  .histogram({
    features: non_ocurrence_sample,
    property: "FWACC",
    minBucketWidth: 1,
  })
  .setOptions({
    title: "Histogram of non-occurance sample in a variable",
    hAxis: {
      title: "Variable X",
      titleTextStyle: { italic: false, bold: true },
    },
    vAxis: {
      title: "Pixel count",
      titleTextStyle: { italic: false, bold: true },
    },
    colors: ["green"],
    legend: { position: "none" },
  });
print(non_ocurence_histogram);

/*************************susceptibility surface histogram****************************************/
//susceptibility surface histogram for all imagem
var susceptibility_chart_1 = ui.Chart.image
  .histogram({ image: rfclass, region: roi, scale: 30, minBucketWidth: 0.01 })
  .setSeriesNames(["classification"])
  .setOptions({
    title: "Suscepbility histogram - roi",
    titlePosition: "none",
    legend: { position: "none" },
    hAxis: {
      title: "Landslide susceptibility rate",
      titleTextStyle: { color: "black", italic: false, bold: true },
      viewWindow: { min: 0, max: 1 },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    vAxis: {
      title: "n° of pixels",
      format: "short",
      titleTextStyle: { color: "black", italic: false, bold: true },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    colors: ["#228b22"],
    fontName: "times new roman",
    fontSize: 40,
  });
print(susceptibility_chart_1);

//susceptibility surface histogram for the landslide scar
var susceptibility_chart_2 = ui.Chart.image
  .histogram({
    image: rfclass,
    region: landslide_scars,
    scale: 30,
    minBucketWidth: 0.01,
  })
  .setSeriesNames(["classification"])
  .setOptions({
    title: "Suscepbility histogram - LS_scars",
    titlePosition: "none",
    legend: { position: "none" },
    hAxis: {
      title: "Landslide susceptibility rate",
      titleTextStyle: { color: "black", italic: false, bold: true },
      viewWindow: { min: 0, max: 1 },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    vAxis: {
      title: "n° of pixels",
      format: "short",
      titleTextStyle: { color: "black", italic: false, bold: true },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    colors: ["Chocolate"],
    fontName: "times new roman",
    fontSize: 40,
  });
print(susceptibility_chart_2);

//susceptibility surface histogram for accuracy assessment samples

//selecting the occurrence samples
var ocurrence_sample_acc = acurracy_evaluation.filter(ee.Filter.eq("class", 1));
var ocurrence_sample_acc = rfclass.reduceRegions(
  ocurrence_sample_acc,
  ee.Reducer.mean()
);

//generating a histogram for the occurrence samples
var ocurence_acc_histogram = ui.Chart.feature
  .histogram({
    features: ocurrence_sample_acc,
    property: "mean",
    minBucketWidth: 0.01,
  })
  .setOptions({
    title: "Histogram of occurance acuracy assessement samples",
    titlePosition: "none",
    hAxis: {
      title: "Landslide susceptibility rate",
      titleTextStyle: { color: "black", italic: false, bold: true },
      viewWindow: { min: 0, max: 1 },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    vAxis: {
      title: "n° of samples",
      format: "short",
      titleTextStyle: { color: "black", italic: false, bold: true },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    colors: ["red"],
    legend: { position: "none" },
    fontName: "times new roman",
    fontSize: 40,
  });
print(ocurence_acc_histogram);

//selecting the non occurrence samples
var non_ocurrence_sample_acc = acurracy_evaluation.filter(
  ee.Filter.eq("class", 0)
);
var non_ocurrence_sample_acc = rfclass.reduceRegions(
  non_ocurrence_sample_acc,
  ee.Reducer.mean()
);

//generating a histogram for the occurrence samples
var non_ocurence_acc_histogram = ui.Chart.feature
  .histogram({
    features: non_ocurrence_sample_acc,
    property: "mean",
    minBucketWidth: 0.01,
  })
  .setOptions({
    title: "Histogram of non-occurance acuracy assessement samples",
    titlePosition: "none",
    hAxis: {
      title: "Landslide susceptibility rate",
      titleTextStyle: { color: "black", italic: false, bold: true },
      viewWindow: { min: 0, max: 1 },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    vAxis: {
      title: "n° of samples",
      format: "short",
      titleTextStyle: { color: "black", italic: false, bold: true },
      textStyle: { color: "black" },
      gridlines: { color: "#A6A6A6" },
    },
    colors: ["#2F5597"],
    legend: { position: "none" },
    fontName: "times new roman",
    fontSize: 40,
  });

print(non_ocurence_acc_histogram);

/***********************dividing the vulnerability surface into categories*************************/
var susceptibility_slices = rfclass
  .where(rfclass.lt(0.25), 1)
  .where(rfclass.gte(0.25).and(rfclass.lt(0.5)), 2)
  .where(rfclass.gte(0.5).and(rfclass.lt(0.65)), 3)
  .where(rfclass.gte(0.65).and(rfclass.lte(1)), 4);

var palette = ["#008000", "#808000", "#FFFF00", "#FF0000"];
Map.addLayer(
  susceptibility_slices,
  { min: 1, max: 4, palette: palette },
  "Reclassified Susceptibility"
);

//Export image to drive
Export.image.toDrive({
  image: susceptibility_slices,
  description: "susceptibility_model1",
  folder: "model_sp",
  region: roi,
  scale: 30,
  crs: "EPSG:4326",
  maxPixels: 1e13,
});
/*****************************Acuracy Evaluation***************************************************/
// Calculate the Receiver Operating Characteristic (ROC) curve

// Chance these as needed
var FF = ee
  .FeatureCollection(acurracy_evaluation)
  .filterMetadata("class", "equals", 1);
var NFF = ee
  .FeatureCollection(acurracy_evaluation)
  .filterMetadata("class", "equals", 0);
var FFrf = rfclass
  .reduceRegions(FF, ee.Reducer.max().setOutputs(["class"]), 30)
  .map(function (x) {
    return x.set("is_target", 1);
  });
var NFFrf = rfclass
  .reduceRegions(NFF, ee.Reducer.max().setOutputs(["class"]), 30)
  .map(function (x) {
    return x.set("is_target", 0);
  });
var combined = FFrf.merge(NFFrf);
//print(combined,'combine')

//chance ROC curve
var ROC_field = "class",
  ROC_min = 0,
  ROC_max = 1,
  ROC_steps = 100,
  ROC_points = combined;

var ROC = ee.FeatureCollection(
  ee.List.sequence(ROC_min, ROC_max, null, ROC_steps).map(function (cutoff) {
    var target_roc = ROC_points.filterMetadata("is_target", "equals", 1);

    // true-positive-rate, sensitivity
    var TPR = ee
      .Number(
        target_roc.filterMetadata(ROC_field, "greater_than", cutoff).size()
      )
      .divide(target_roc.size());
    var non_target_roc = ROC_points.filterMetadata("is_target", "equals", 0);

    // true-negative-rate, specificity
    var TNR = ee
      .Number(
        non_target_roc.filterMetadata(ROC_field, "less_than", cutoff).size()
      )
      .divide(non_target_roc.size());
    return ee.Feature(null, {
      cutoff: cutoff,
      TPR: TPR,
      TNR: TNR,
      FPR: TNR.subtract(1).multiply(-1),
      dist: TPR.subtract(1).pow(2).add(TNR.subtract(1).pow(2)).sqrt(),
    });
  })
);

// Use trapezoidal approximation for area under curve (AUC)
var X = ee.Array(ROC.aggregate_array("FPR")),
  Y = ee.Array(ROC.aggregate_array("TPR")),
  Xk_m_Xkm1 = X.slice(0, 1).subtract(X.slice(0, 0, -1)),
  Yk_p_Ykm1 = Y.slice(0, 1).add(Y.slice(0, 0, -1)),
  AUC = Xk_m_Xkm1.multiply(Yk_p_Ykm1)
    .multiply(0.5)
    .reduce("sum", [0])
    .abs()
    .toList()
    .get(0);
print(AUC, "Area under curve");
// Plot the ROC curve
print(
  ui.Chart.feature.byFeature(ROC, "FPR", "TPR").setOptions({
    title: "ROC curve",
    legend: "none",
    hAxis: { title: "False-positive-rate" },
    vAxis: { title: "True-negative-rate" },
    lineWidth: 1,
  })
);
// find the cutoff value whose ROC point is closest to (0,1) (= "perfect classification")
var ROC_best = ROC.sort("dist")
  .first()
  .get("cutoff")
  .aside(print, "best ROC point cutoff");

// Reference
// 1. https://rbgeomorfologia.org.br/rbg/article/view/2491/386386887
