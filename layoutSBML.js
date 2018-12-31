/////////////////////////////////////////////////////////////////
// layoutSBML1.js: Code to define chemical system in js for the purposes
// of layout and display in a browser
/////////////////////////////////////////////////////////////////

const pixelWidth = 700;
const pixelHeight = 600;

var svgContainer = "";
var cx = 500.0;
var cy = 420.0;
var wx = 150;
var wy = 150;
var isZoomedOut = true;

const textXoffset = 0.3;
const textScale = 1.0;
const poolWidth = 6.0;
const poolHeight = 1.5;
const arrowWidth = 0.25;
const slotXspacing = 10.0;
const reacMsgColor = "green";
const groupFillColor = "cornsilk";
const groupTextColor = "darkblue";


var objLookup = {};
var centredGroup = "";

var poolData = [];
var reacData = [];
var enzData = [];
var mmEnzData = [];
var chanData = [];
var groupData = [];
var msgData = [];
var poolProxies = [];
var reacProxies = [];

/////////////////////////////////////////////////////////////////////////
// Some stuff for screen size scaling
/////////////////////////////////////////////////////////////////////////

var xScale = d3.scale.linear()
	.domain( [cx - wx/2, cx + wx/2] )
	.range( [0, pixelWidth] )

var yScale = d3.scale.linear()
	.domain( [ cy + wy/2, cy - wy/2] )
	.range( [ 0, pixelHeight] )

var xObjScale = d3.scale.linear()
	.domain( [ 0, wx ] )
	.range( [ 0, pixelWidth] )

var yObjScale = d3.scale.linear()
	.domain( [ 0, wy ] )
	.range( [ 0, pixelHeight] )

/////////////////////////////////////////////////////////////////

/**
/// Define the class info
function ClassInfo( name, icon, showText ) {
		this.name = name;
		this.icon = icon;
}
*/

function ChemObj( name, className, id, color, textfg, x, y, notes) {
		this.name = name;
		this.className = className;
		this.parentObj = "";
		this.id = id;
		this.fg = color;
		this.textfg = textfg;
		this.opacity = 1;
		this.x = x;
		this.y = y;
		this.dispx = x;
		this.dispy = y;
		this.ndisp = 1;
		this.notes = "";
		/*
		this.children = {};
		this.addChild = function( childObj ) {
			this.children[childObj.name] = childObj
		}
		*/
}

/// Returns a color. Arg is a numeric value 0-63 or a color name
function convColor( val, shading = 0.0 ){
	if ( isNaN( val ) ) {
		return val;
	} else {
		ret = d3.interpolateSpectral( Math.round(val/64.0) );
		return shadeRGBColor( ret, shading );
	}
}

/// From Stack Overflow Pimp Trizkit.
function shadeRGBColor(color, percent) {
    var f=color.split(","),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=parseInt(f[0].slice(4)),G=parseInt(f[1]),B=parseInt(f[2]);
    return "rgb("+(Math.round((t-R)*p)+R)+","+(Math.round((t-G)*p)+G)+","+(Math.round((t-B)*p)+B)+")";
}

function makeBaseObj( className, xobj, anno, attr, annoName  ) {
	if ( typeof anno === "undefined") {
		throw "makeBaseObj failed, annotation not present";
	}
	manno = anno.getElementsByTagName(annoName);
	if ( (typeof manno !== "undefined") && (manno.length > 0 ) ) {
		var name = attr.getNamedItem("name").nodeValue;
		var id = attr.getNamedItem("id").nodeValue;
		var x = parseFloat(manno[0].getElementsByTagName("moose:xCord")[0].textContent);
		var y = parseFloat(manno[0].getElementsByTagName("moose:yCord")[0].textContent);
		var textfg = convColor( manno[0].getElementsByTagName("moose:textColor")[0].textContent );
		var bg = convColor( manno[0].getElementsByTagName("moose:bgColor")[0].textContent);
		var xnotes = xobj.getElementsByTagName("notes");
		var notes = ""
		if (xnotes.length > 0 ) {
			notes = xnotes[0].textContent;
		}
		return new ChemObj( name, className, id, bg, textfg, x,y, notes );
	} else {
		throw "makeBaseObj failed, annotation '" + annoName + "' not known";
	}
}

/////////////////////////////////////////////////////////////////

function GroupObj( xgroup, anno, attr ) {
	var id = attr.getNamedItem( "groups:id" ).nodeValue;
	var name = attr.getNamedItem( "groups:name" ).nodeValue;

	
	var manno = anno.getElementsByTagName("moose:GroupAnnotation");
	this.compartment = manno[0].getElementsByTagName("moose:Compartment")[0].textContent;
	var bg = manno[0].getElementsByTagName("moose:bgColor")[0].textContent;
	this.base = new ChemObj( name, "Group", id, convColor(bg, 0.6), "yellow", 0,0, "" );
	var members = xgroup.getElementsByTagName("groups:member");
	this.width = 10;
	this.height = 10;
	this.children = [];
	this.enzChildren = [];
	this.assignChildParents = function() {
		this.children = this.children.filter( function(value, idx, arr) {
			return typeof objLookup[ value ] !== "undefined";
		} );
		var k;
		for (k = 0; k < this.children.length ; k++ ) {
			objLookup[ this.children[k] ].base.parentObj = this; 
		}
	}
	this.addEnzChild = function( enzObj ) {
		this.enzChildren.push( enzObj.base.id )
	}
	this.updateCoords = function() {
		var k;
		var x = [];
		var y = [];
		for (k = 0; k < this.children.length ; k++ ) {
			var child = objLookup[ this.children[k] ]; 
			x.push( child.base.x );
			y.push( child.base.y );
		}
		if ( this.children.length > 0 ) {
			this.base.x = Math.min( ...x ) - 0.6*poolWidth; // Another dumb syntax.
			this.base.y = Math.min( ...y ) - poolHeight;
			this.base.dispx = this.base.x;
			this.base.dispy = this.base.y;
			this.width = 0.8 * poolWidth + Math.max( ...x ) - this.base.x;
			this.height = 2 * poolHeight + Math.max( ...y ) - this.base.y;
		}
	}

	for (k = 0; k < members.length; k++ ) {
		var childId = members[k].attributes.getNamedItem( "groups:idRef" ).nodeValue;
		this.children.push( childId );
	}
	
	this.setOpacity = function( opacity ) {
		// Even if the opacity hasn't changed, child objects may have gained
		// or lost message links which affect their opacity. So we update
		// all regardless.
		if ( centredGroup == this ) { // Don't blank it
			opacity = 1;
		}
		// In all the remaining cases, we go through and set opacity
		// recursively.
		this.base.opacity = opacity;
		this.setChildOpacity( this.children );
		this.setChildOpacity( this.enzChildren );
	}

	this.setChildOpacity = function( children ) {
		var j;
		for ( j = 0; j < children.length; j++ ) {
			child = objLookup[ children[j] ];
			if ( typeof child !== "GroupObj" ) {
			// Let the outer loop through groups handle child groups.
				child.base.opacity = this.base.opacity;
				child.base.dispx = 0;
				child.base.dispy = 0;
				child.base.ndisp = 0;
			}
		}
	}

	this.computeProxyLayout = function() {
		// for now a dummy function, just averages out the coords.
		computeGroupChildLayout( this.children );
		computeGroupChildLayout( this.enzChildren );
	}
	this.zoomInOut = function() {
	// Toggles between zoom for current group, and for entire frame.
		if ( isZoomedOut ) {
			wx = 1.1 * this.width + 4 * poolWidth;
			wy = 1.2 * this.height + 4 * poolHeight;
			cx = this.base.x + wx/2 - 3 * poolWidth;
			cy = this.base.y + wy/2 - 4 * poolHeight;
			isZoomedOut = false;
			setDisplayScales();
		} else {
			zoomToEntireModel();
		}
		zoomVisibility();
		transition(svgContainer);
	}
}

function computeGroupChildLayout( children ) {
	var j;
	for ( j = 0; j < children.length; j++ ) {
		child = objLookup[ children[j] ];
		if ( child.base.ndisp > 0 ) {
			child.base.dispx /= child.base.ndisp;
			child.base.dispy /= child.base.ndisp;
			if ( child.base.dispy > cy ) {
				poolProxies.push( child );
			} else {
				reacProxies.push( child );
			}
		} else {
			child.base.dispx = child.base.x;
			child.base.dispy = child.base.y;
		}
	}
}

/////////////////////////////////////////////////////////

function PoolObj( xpool, anno, attr ) {
	try {
		var base = makeBaseObj( "Pool", xpool, anno, attr, "moose:ModelAnnotation" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": PoolObj: Failed to build";
		return;
	}
	this.base = base;
	this.CoInit = 1000*parseFloat(attr.getNamedItem("initialConcentration").nodeValue);
	this.isBuffered = attr.getNamedItem("constant").nodeValue;
	var manno = anno.getElementsByTagName("moose:ModelAnnotation");
	this.diffConst = manno[0].getElementsByTagName("moose:diffConstant")[0].textContent;
	this.motorConst = manno[0].getElementsByTagName("moose:motorConstant")[0].textContent;
}

/////////////////////////////////////////////////////////

function addEnzSubToMsg( id, xenz, enzPool, fg ) {
	var xlist = xenz.getElementsByTagName( "listOfReactants" );
	var enzPa = "";
	if (xlist.length > 0 ) {
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ) {
			var sattr = xpool[k].attributes;
			var pool = sattr.species.nodeValue;
			if (pool != enzPool ) { // Avoid parent pool of enzyme
				var numpool=sattr.getNamedItem( "stoichiometry" ).nodeValue;
				msgData.push( new MsgObj( "EnzSub", pool,  id,  numpool, fg ) );
			}
		}
	}
}

function addEnzPrdToMsg( id, xenz, enzPool, fg ) {
	var xlist = xenz.getElementsByTagName( "listOfProducts" );
	var enzPa = "";
	if (xlist.length > 0 ) {
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ) {
			var sattr = xpool[k].attributes;
			var pool = sattr.species.nodeValue;
			if (pool != enzPool ) { // Avoid parent molecule of enzyme
				var numpool=sattr.getNamedItem( "stoichiometry" ).nodeValue;
				msgData.push( new MsgObj( "EnzPrd", id,  pool,  numpool, fg ) );
			}
		}
	}
}

function addReactantsToMsg( id, xreac, listName, msgName, fg ) {
	var xlist = xreac.getElementsByTagName( listName );
	var enzPa = "";
	if (xlist.length > 0 ) {
		var startIdx = 0;
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ){
			var sattr = xpool[k].attributes;
			// pool = sattr.getNamedItem( "species" ).nodeValue;
			var pool = sattr.species.nodeValue;
			var numpool = sattr.getNamedItem( "stoichiometry" ).nodeValue;
			if ( msgName.indexOf( "Prd" ) != -1 ) {
				msgData.push( new MsgObj( msgName, id,  pool,  numpool, fg ) );
			} else {
				msgData.push( new MsgObj( msgName, pool,  id,  numpool, fg ) );
			}
		}
	}
	return enzPa;
}

/////////////////////////////////////////////////////////

function ReacObj( xreac, anno, attr ) {
	try {
		var base = makeBaseObj( "Reac", xreac, anno, attr, "moose:ModelAnnotation" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": ReacObj: Failed to build: " + attr.getNamedItem("id").nodeValue;
		return;
	}
	this.base = base;
	xparams = xreac.getElementsByTagName("localParameter");
	if (xparams.length > 0) {
		this.Kf = xparams[0].attributes.getNamedItem("value").nodeValue;
		if (xparams.length > 1) {
			this.Kb = xparams[1].attributes.getNamedItem("value").nodeValue;
		}
	}
	addReactantsToMsg( base.id, xreac, "listOfReactants", "ReacSub",reacMsgColor);
	addReactantsToMsg( base.id, xreac, "listOfProducts", "ReacPrd", reacMsgColor);
}

function getEnzParent( xenz, anno ) {
	manno = anno.getElementsByTagName("moose:EnzymaticReaction");
	if ( (typeof manno !== "undefined") && (manno.length > 0 ) ) {
		var enzMol = manno[0].getElementsByTagName("moose:enzyme")[0].textContent;
		return enzMol;
	}
	return "";
}

/////////////////////////////////////////////////////////

function EnzObj( xenz, anno, attr ) {
	try {
		var base = makeBaseObj( "Enz", xenz, anno, attr, "moose:EnzymaticReaction" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": EnzObj: Failed to build";
		return;
	}
	this.base = base;
	var xparams = xenz.getElementsByTagName("localParameter");
	this.Km = 0.0;
	this.enzPool = getEnzParent(xenz, anno );
	if (xparams.length > 0) {
		this.K1 = parseFloat( xparams[0].attributes.getNamedItem("value").nodeValue );
		if (xparams.length > 1) {
			this.K2 = parseFloat( xparams[1].attributes.getNamedItem("value").nodeValue );
		}
	}
	this.addProduct = function( xenz, anno, attr ) {
		var xparams = xenz.getElementsByTagName("localParameter");
		if (xparams.length > 0) {
			this.kcat = parseFloat( xparams[0].attributes.getNamedItem("value").nodeValue );
			this.Km = (this.kcat + this.K2)/this.K1;
		}
		addEnzPrdToMsg( base.id, xenz, this.enzPool, "red");
	}
	addEnzSubToMsg( base.id, xenz, this.enzPool, "red" );
}

/////////////////////////////////////////////////////////

function MMEnzObj( xenz, anno, attr, id, enzPool ) {
	try {
		var base = makeBaseObj( "MMEnz", xenz, anno, attr, "moose:EnzymaticReaction" );
	}
	catch( err ) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": MMEnzObj: Failed to build";
		return;
	}
	this.base = base;
	this.enzPool = enzPool;
	xparams = xenz.getElementsByTagName("localParameter");
	if (xparams.length >= 2) { // There must be a way to check id
		this.Km = xparams[0].attributes.getNamedItem("value").nodeValue;
		this.kcat = xparams[1].attributes.getNamedItem("value").nodeValue;
	}
	addReactantsToMsg( base.id, xenz, "listOfReactants", "MMEnzSub", "blue" );
	addReactantsToMsg( base.id, xenz, "listOfProducts", "MMEnzPrd", "blue" );
}

/////////////////////////////////////////////////////////

function MsgObj( type, src, dest, stoichiometry, fg ) {
	this.type = type;
	this.src = src;
	this.dest = dest;
	this.fg = fg;
	this.markerURL = "url(#redarrow)";
	if ( fg == "green" || fg == reacMsgColor ) {
		this.markerURL = "url(#greenarrow)";
	} else if ( fg == "blue" || fg == "cyan" ) {
		this.markerURL = "url(#bluearrow)";
	}
	this.stoichiometry = stoichiometry;
	this.x0 = 0.0;
	this.y0 = 0.0;
	this.x1 = 0.0;
	this.y1 = 0.0;
	this.opacity = 1.0;
	this.setProxyAndOpacity = function() {
		var srcObj = objLookup[this.src];
		var destObj = objLookup[this.dest];
		if ( typeof srcObj.base.parentObj.base === "undefined" || typeof destObj.base.parentObj.base === "undefined" ) {
			alert( "OMg, failed" );
		}
		this.opacity = 1;
		// Note that the objects have multiple messages, so we need to 
		// logically combine opacity, not just assign it. Initial opacity
		// is set by group, and placeObjProxy sets to 1 if needed.
		if ( srcObj.base.parentObj.base.opacity == 1 ) {
			if ( destObj.base.parentObj.base.opacity == 1 ) {
				this.dasharray = "";
			} else { // grp of destObj is not visible
				this.dasharray = "3, 3";
				placeObjProxy( this.x0, this.y0, destObj );
			}
		} else { // Grp of srcObj is not visible
			if ( destObj.base.parentObj.base.opacity == 1 ) {
				this.dasharray = "3, 3";
				placeObjProxy( this.x1, this.y1, srcObj );
			} else { // Neither obj group is visible.
				this.opacity = 0;
				// Leave the opacity of the obj as it was.
			}
		}
	}

	this.rawTermini = function() {
		var s = objLookup[this.src].base;
		var d = objLookup[this.dest].base;
		this.x0 = s.x;
		this.y0 = s.y;
		this.x1 = d.x;
		this.y1 = d.y;
	}

	this.calcTermini = function() {
		var s = objLookup[this.src].base;
		var d = objLookup[this.dest].base;
		var vx = d.dispx - s.dispx;
		var vy = d.dispy - s.dispy;
		var len = Math.sqrt( vx*vx + vy*vy );
		if ( len < 0.1 ) {
			len = 1.0;
		}
		this.x0 = s.dispx + 0.5*poolWidth*vx/len;
		this.y0 = s.dispy + 0.5*poolHeight*vy/len;
		this.x1 = d.dispx - 0.5*poolWidth*vx/len;
		this.y1 = d.dispy - 0.5*poolHeight*vy/len;
		return this.x0;
	}
	// Algo: get x0, y0, x1, y1 for each object right off. Then the arrow
	// terminus is offset along the vector of the msg, by an ellipse.
	// Put in a getter instead, so that the msgs track their ends 
	// Remarkably filthy synatx. Challenges C++ on this.
	Object.defineProperty( this, 'calcX0',
			{ get: function(){ return this.calcTermini();} } 
	);
}

function placeObjProxy( x, y, obj ) {
	obj.base.opacity = 1;
	if ( obj.base.className == "Pool" ) { // Place above
		obj.base.dispy += cy + wy/2 - poolHeight;
	} else { // Enz and reacs go below
		obj.base.dispy += cy - wy/2 + poolHeight / 2;
		// obj.base.dispy += y + poolHeight * 2 ;
	}
	obj.base.dispx += x + poolWidth / 2 ;
	obj.base.ndisp++;
}


/////////////////////////////////////////////////////////////////////////


function parseGroups(xmlDoc) {
  var groups = xmlDoc.getElementsByTagName("groups:group");
  var i;
  for (i = 0; i< groups.length; i++) {
	var anno = groups[i].getElementsByTagName("annotation")
	if ( anno.length > 0 ) {
		groupData.push( new GroupObj( groups[i], anno[0], groups[i].attributes ) );
	}
  }
}


function parsePools(xmlDoc) {
  var pools = xmlDoc.getElementsByTagName("species");
  var i;
  for (i = 0; i< pools.length; i++) {
	var anno = pools[i].getElementsByTagName("annotation")
	if ( anno.length > 0 ) {
		poolData.push( new PoolObj( pools[i], anno[0], pools[i].attributes ) );
	}
  }
}
/////////////////////////////////////////////////////////////////////////

function reacType( reac, anno, attr ) {
	id = attr.getNamedItem("id").nodeValue;
	if ( anno.getElementsByTagName("moose:ModelAnnotation").length > 0 ) {
		return [0, id]; // reac
	}
	// if (typeof anno.getElementsByTagName("moose:EnzymaticReaction") !== "undefined" ) {
	if ( anno.getElementsByTagName("moose:EnzymaticReaction").length > 0 ) {
		if (id.indexOf("_Complex_formation_") != -1) {
			return [1, id]; // reac1/2 of mass action enzyme
		} else if (id.indexOf("_Product_formation_") != -1) {
			return [2, id]; // reac 3 of mass action enzyme
		} else {
			var mod = reac.getElementsByTagName("modifierSpeciesReference");
			if (mod.length > 0 && typeof mod[0] !== "undefined") {
				var enzPool = mod[0].attributes.getNamedItem("species").nodeValue;
				return [3, id, enzPool]; // MM enzyme. Ugh.
			}
		}
	}
	throw "reacType unknown for id: '" + id + "'";
}

function parseReacs(xmlDoc) {
  reacs = xmlDoc.getElementsByTagName("reaction");
  for (i = 0; i< reacs.length; i++) {
	anno = reacs[i].getElementsByTagName("annotation");
	if ( anno.length == 0 ) {
		document.getElementById("ErrMsg").innerHTML = "parseReacs failed: no annotations found.";
		return;
	}
	attr = reacs[i]. attributes;
 	try {
		ret = reacType( reacs[i], anno[0], attr );
	}
	catch (err) {
		document.getElementById("ErrMsg").innerHTML = err.message + ": Failed in parseReacs";
		return;
	}
	if ( ret[0] == 0 ) {
		reacData.push( new ReacObj( reacs[i], anno[0], attr ) );
	} else if ( ret[0] == 1 ) {
		enzData.push( new EnzObj( reacs[i], anno[0], attr ) )
	} else if ( ret[0] == 2 ) {
		enzData[enzData.length -1].addProduct( reacs[i], anno[0], attr )
	} else if ( ret[0] == 3 ) {
		mmEnzData.push( new MMEnzObj( reacs[i], anno[0], attr, ret[1], ret[2] ) )
	}
  }
}
/////////////////////////////////////////////////////////////////////////

function clearAllArrays() {
	objLookup = {}; // Lengthy stack exchange discussion, here I leave it
			// to the tender mercies of the garbage collector to clean.
	centredGroup = "";
	poolData.length = 0;
	reacData.length = 0;
	enzData.length = 0;
	mmEnzData.length = 0;
	chanData.length = 0;
	groupData.length = 0;
	msgData.length = 0;
	poolProxies.length = 0;
	reacProxies.length = 0;
}

function clearSvgContainer( svgContainer ) {
	svgContainer.selectAll("rect").remove();
	svgContainer.selectAll("text").remove();
	svgContainer.selectAll("polyline").remove();
	svgContainer.selectAll("line").remove();
}

function loadXMLDoc() {
	var fobj = document.getElementById("sbmlFile");
	var txt = "Select a file";
	if ( 'files' in fobj ) {
		if (fobj.files.length > 0) {
			clearAllArrays();
			fn = fobj.files[0].name;
			txt = "Displaying: " + fn;
			var extn = txt.split('.').pop().toLowerCase();
			if (extn == "xml" || extn == "sbml" ) {
  				var xmlhttp = new XMLHttpRequest();
  				xmlhttp.onreadystatechange = function() {
    				if (this.readyState == 4 && this.status == 200) {
      					parseSBML(this);
	  					addAllObjToLookup(); // Also puts pools on groups.
						if ( svgContainer == "" ){
	  						svgContainer = doLayout();
						} else {
							clearSvgContainer( svgContainer );
						}
						redraw( svgContainer );
    				}
  				};
  				xmlhttp.open("GET", fn, true);
  				xmlhttp.send();
			} else {
				txt = "Please select an SBML file.";
			}
		}
	}
	document.getElementById( "fname" ).innerHTML = txt;
}


function parseSBML(xml) {
  var xmlDoc, txt;
  xmlDoc = xml.responseXML;
  var txt = "";
  parsePools( xmlDoc );
  parseReacs( xmlDoc );
  parseGroups( xmlDoc );
  txt += "Num Pools = " + poolData.length + "<br>";
  document.getElementById("pools").innerHTML = txt;
  txt = "Num Reacs = " + reacData.length + "<br>";
  document.getElementById("reacs").innerHTML = txt;
  txt = "Num Mass Action Enz = " + enzData.length + "<br>";
  document.getElementById("enz").innerHTML = txt;
  txt = "Num MM Enz = " + mmEnzData.length + "<br>";
  document.getElementById("mmenz").innerHTML = txt;
  txt = "Num Groups = " + groupData.length + "<br>";
  document.getElementById("groups").innerHTML = txt;
  txt = "Num Msgs = " + msgData.length + ", visible = " + msgData.length + "<br>";
  document.getElementById("msgs").innerHTML = txt;
}

function zoomToEntireModel() {
	cx = cy = -1e6;
	wx = wy = 1e6;
	for ( const key in objLookup ) {
		var b = objLookup[key].base;
		if ( cx < b.x ) cx = b.x;
		if ( cy < b.y ) cy = b.y;
		if ( wx > b.x ) wx = b.x;
		if ( wy > b.y ) wy = b.y;
	}
	var temp = cx - wx; // Get the width;
	cx = (cx + wx) / 2.0;
	wx = 1.4*temp + 2 * poolWidth;
	temp = cy - wy; // Get the height;
	cy = (cy + wy) / 2.0;
	wy = 1.4*temp + 2 * poolHeight;
	isZoomedOut = true;

	setDisplayScales();
}

function addAllObjToLookup() {
	poolData.forEach( addObjToLookup );
	reacData.forEach( addObjToLookup );
	enzData.forEach( addObjToLookup );
	mmEnzData.forEach( addObjToLookup );
	groupData.forEach( addObjToLookup );
	zoomToEntireModel();

	groupData.forEach( assignChildParents );
	enzData.forEach( addEnzToGroup );
	mmEnzData.forEach( addEnzToGroup );
	groupData.forEach( updateGroupCoords );
}

function addObjToLookup( obj ) {
	objLookup[ obj.base.id ] = obj;
}

function assignChildParents( grp ) {
	grp.assignChildParents()
}

function updateGroupCoords( grp ) {
	grp.updateCoords()
}

function addEnzToGroup( enz ) {
	enzPool = objLookup[enz.enzPool];
	if ( typeof enzPool === "undefined"  ) {
			alert( "addEnzToGroup, failed; not in objLookup" );
	}
	if ( typeof enzPool === "undefined" || typeof enzPool.base.parentObj.base === "undefined" ) {
			alert( "addEnzToGroup, failed" );
	}
	enz.base.parentObj = enzPool.base.parentObj;
	enz.base.parentObj.addEnzChild( enz );
}

/////////////////////////////////////////////////////////////////////////

/////////////////////////////////////////////////////////////////////////
// Making the svg stuff for web page
/////////////////////////////////////////////////////////////////////////
	
function reacLineFunction( x, y ) {
	var ret =
	xScale(x-1).toFixed(2) + "," + yScale(y-0.7).toFixed(2) + " " +
	xScale(x-1.6).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+1.6).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+1).toFixed(2) + "," + yScale(y+0.7).toFixed(2);
	// console.log(ret);
	// tottxt += ret + "<br>";
	return ret;
}

function enzLineFunction( x, y ) {
	var ret =
	xScale(x).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+1).toFixed(2) + "," + yScale(y+0.5).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y+0.8).toFixed(2) + " " +
	xScale(x-1.6).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y-0.8).toFixed(2) + " " +
	xScale(x+1).toFixed(2) + "," + yScale(y-0.5).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y).toFixed(2);
	// console.log(ret);
	return ret;
}

function zoomVisibility() {
	var j;
	var minR = 1e6;
	var opacity = [];
	for ( j = 0; j < groupData.length; j++ ) {
		var grp = groupData[j];
		var dx = grp.base.x + grp.width/2.0 - cx;
		var dy = grp.base.y + grp.height/2.0 - cy;
		var r = Math.sqrt( dx*dx + dy*dy );
		opacity.push( 1.0 * ((r + poolWidth) < (wx + wy)/4) );
		if ( minR > r ) {
			minR = r;
			centredGroup = grp;
		}
	}
	for ( j = 0; j < groupData.length; j++ ) {
		groupData[j].setOpacity( opacity[j] )
	}
	
	msgData.forEach( function( msg ) { msg.rawTermini()  } );
	msgData.forEach( function( msg ) { msg.setProxyAndOpacity()  } );
	poolProxies.length = 0;
	reacProxies.length = 0;
	groupData.forEach( function( grp ) { grp.computeProxyLayout() } );
	spaceOut( poolProxies );
	spaceOut( reacProxies );
}

function spaceOut( objArray ) {
	if ( objArray.length == 0 )
		return;
	objArray.sort( function( a, b ) { 
			return a.base.dispx - b.base.dispx;
	} );
	var dx = (wx - poolWidth ) / objArray.length;
	var x = cx - wx/2 + poolWidth/2 + dx/2;
	objArray.forEach( function ( obj ) { obj.base.dispx = x; x+= dx } );
}

function setDisplayScales() {
	xScale = d3.scale.linear()
		.domain( [cx - wx/2, cx + wx/2] )
		.range( [0, pixelWidth] )
	yScale = d3.scale.linear()
		.domain( [ cy + wy/2, cy - wy/2] )
		.range( [ 0, pixelHeight] )
	xObjScale = d3.scale.linear()
		.domain( [ 0, wx ] )
		.range( [ 0, pixelWidth] )
	yObjScale = d3.scale.linear()
		.domain( [ 0, wy ] )
		.range( [ 0, pixelHeight] )
}

function doLayout() {
  var svgContainer = d3.select("body")
	.append("svg")
	.attr( "width", pixelWidth )
	.attr( "height", pixelHeight )
	.style( "border", "3px solid blue")
	.style( "background-color", "lightblue");

  d3.select("body")
	.on("keydown", function() {
		var kc = d3.event.keyCode;
		if (kc == 38 ) { // Up arrow
			cy -= wy/20;
		} else if (kc == 40 ) { // down arrow
			cy += wy/20;
		} else if (kc == 37 ) { // left arrow
			cx += wx/20;
		} else if (kc == 39 ) { // right arrow
			cx -= wx/20;
		} else if (kc == 188) { // comma or <, for zooming out
			wx *= 1.1;
			wy *= 1.1;
		} else if (kc == 190) { // period or >, for zooming in
			wx /= 1.1;
			wy /= 1.1;
		}
		isZoomedOut = false;
		setDisplayScales();

		document.getElementById("ErrMsg").innerHTML = "Coords:(" + cx.toFixed(2) + "," + cy.toFixed(2) + "), window = (" + wx.toFixed(2) + "," + wy.toFixed(2) + ")";
		zoomVisibility();

  		var txt = "Num Msgs = " + msgData.length + ", visible = " + msgData.length + "<br>";
  		document.getElementById("msgs").innerHTML = txt;
		transition(svgContainer);
	});

  defs = svgContainer.append( "defs" );
  defs.append( "marker" )
	.attr({
		"id":"redarrow",
		"viewBox":"0 -5 10 10",
		"refX":5,
		"refY":0,
		"markerWidth":4,
		"markerHeight":4,
		"orient":"auto"
	})
	.append("path")
		.attr("d", "M0,-5L10,0L0,5")
		.attr("fill", "red")
		.attr("class","arrowHead");

  defs.append( "marker" )
	.attr({
		"id":"greenarrow",
		"viewBox":"0 -5 10 10",
		"refX":5,
		"refY":0,
		"markerWidth":4,
		"markerHeight":4,
		"orient":"auto"
	})
	.append("path")
		.attr("d", "M0,-5L10,0L0,5")
		.attr("fill", reacMsgColor)
		.attr("class","arrowHead");

  defs.append( "marker" )
	.attr({
		"id":"bluearrow",
		"viewBox":"0 -5 10 10",
		"refX":5,
		"refY":0,
		"markerWidth":4,
		"markerHeight":4,
		"orient":"auto"
	})
	.append("path")
		.attr("d", "M0,-5L10,0L0,5")
		.attr("fill", "blue")
		.attr("class","arrowHead");
	
	return svgContainer;
}

////////////////////////////////////////////////////////////////////////
function poolMouseOver( div, d ) {
	div.transition()
		.duration(200)
		.style("opacity", 0.9);
	div.html( d.base.name + "<br/>CoInit: " + d.CoInit.toPrecision(3) )
		.style( "left", (d3.event.pageX) + "px")
		.style( "top", (d3.event.pageY - 28 ) + "px" );
}


function redraw( svgContainer ) {
  zoomVisibility(); // Update all the object opacity settings.
  var div = d3.select("body").append("div")
	.attr( "class", "tooltip" )
	.style( "opacity", 0);

  var gdata = svgContainer.selectAll( ".groups" )
	.data( groupData )

  var group = gdata.enter().append("rect").attr("class", "groups" );

  var groupIcons = group
	.attr( "x", function(d) {return xScale(d.base.dispx)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height )} )
	.attr( "width", function(d) { return xObjScale(d.width ) } )
	.attr( "height", function(d) { return yObjScale(d.height ) } )
	.attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke-width", "2" )
	.attr( "fill", groupFillColor )
	.on( "dblclick", function(d) { d.zoomInOut() } );

  var groupText = gdata.enter().append( "text" )
	.attr( "class", "groups" )
	.attr( "x", function(d) {return xScale(d.base.dispx) } )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height/2) } )
	.attr( "font-family", "sans-serif" )
	.attr( "font-size", function(d) { return ""+Math.round(16 + xObjScale(textScale))+"px"} )
	.attr( "fill", groupTextColor )
	.text( function(d){return d.base.name} )
	.on( "dblclick", function(d) { d.zoomInOut() } );

  gdata.exit().remove();

	////////////////////////////////
  var pdata = svgContainer.selectAll( ".pools" )
	.data( poolData )

  var pool = pdata.enter().append("rect").attr("class", "pools" );

  var poolIcons = pool
	.attr( "x", function(d) {return xScale(d.base.dispx - poolWidth/2)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + poolHeight/2)} )
	.attr( "width", xObjScale(poolWidth) )
	.attr( "height", yObjScale(poolHeight) )
	.attr( "fill", function(d) {return d.base.fg} )
	.attr( "stroke", "black" )
	.attr( "stroke-width", "1" )
	.on( "mouseover", function(d) { poolMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});

  var poolText = pdata.enter().append( "text" )
	.attr( "class", "pools" )
	.attr( "x", function(d){return xScale(d.base.dispx-textXoffset * d.base.name.length) } )
	.attr( "y", function(d) {return yScale(d.base.dispy - 1 + poolHeight/2)} )
	.attr( "font-family", "sans-serif" )
	.attr( "font-size", function(d) { return ""+Math.round(xObjScale(textScale))+"px"} )
	.attr( "fill", function(d){return d.base.textfg} )
	.text( function(d){return d.base.name} )
	.on( "mouseover", function(d) { poolMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});

  pdata.exit().remove();

///////////////////////////////////

  var rdata = svgContainer.selectAll( ".reacs" )
	.data( reacData )
  var reac = rdata.enter().append("polyline").attr("class", "reacs");

  var reacIcons = reac
	.attr( "points", function(d) {return reacLineFunction( d.base.dispx, d.base.dispy ) } )
	.attr( "stroke", function(d) { return d.base.parentObj.base.fg  }  )
	.attr( "stroke-width", "2" )
	.attr( "fill", "none" )
	.on( "mouseover", function(d) { 
		div.transition()
			.duration(200)
			.style("opacity", 0.9);
		div.html( "Kf= " + d.Kf + "<br/>" + "Kb= " + d.Kb )
			.style( "left", (d3.event.pageX) + "px")
			.style( "top", (d3.event.pageY - 28 ) + "px" );
	} )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});

  rdata.exit().remove();
///////////////////////////////////

  var edata = svgContainer.selectAll( ".enzs" )
	.data( enzData )

  var enz = edata.enter().append("polyline").attr("class", "enzs");

  var enzIcons = enz
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )
	//.attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke", "black" )
	.attr( "stroke-width", "1" )
	.attr( "fill", function(d) {return d.base.fg} )
	.on( "mouseover", function(d) { 
		div.transition()
			.duration(200)
			.style("opacity", 0.9);
		pa = objLookup[ d.enzPool ];
		var enzPath = "";
		if ( typeof pa !== "undefined" ) {
			enzPath = pa.base.name + '/' + d.base.name;
		} else {
			enzPath = "?/" + d.base.name;
		}
		div.html( enzPath + "<br/>Km= " + d.Km.toPrecision(3) + "<br/>kcat= " + d.kcat.toPrecision(3) )
			.style( "left", (d3.event.pageX) + "px")
			.style( "top", (d3.event.pageY - 28 ) + "px" );
	} )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	});
///////////////////////////////////

  var medata = svgContainer.selectAll( ".mmenzs" )
	.data( mmEnzData )

  var mmenz = medata.enter().append("polyline").attr("class", "mmenzs");

  var mmenzIcons = mmenz
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )
	.attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke-width", "2" )
	.attr( "fill", "none" );
///////////////////////////////////

  var mdata = svgContainer.selectAll( "line" )
	.data( msgData )

  var msgs = mdata
	.enter()
	.append("line")
		.attr( "class", "arrow" )
		.attr( "stroke", function(d) {return d.fg} )
		// .attr( "stroke-width", 2 )
		.attr( "stroke-width", function(d) { return xObjScale(arrowWidth)} )
		// .attr( "marker-end", "url(#arrow)" )
		.attr( "marker-end", function(d) {return d.markerURL } )
		.attr( "x1", function(d) {return xScale(d.calcX0) } )
		.attr( "y1", function(d) {return yScale(d.y0) } )
		.attr( "x2", function(d) {return xScale(d.x1) } )
		.attr( "y2", function(d) {return yScale(d.y1) } )
		.attr( "opacity", function(d) {return d.opacity} );
	// Turns out d3 doesn't have a way to change marker color. So we need
	// separate markers to represent each color. Stupid.
}
/////////////////////////////////////////////////////////////////////////
// Here we define the transitions.
/////////////////////////////////////////////////////////////////////////
function transition( svgContainer ) {
	////////////////// groups /////////////////////////
  var gdata = svgContainer.selectAll( "rect.groups" )
  gdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.dispx)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height)} )
	.attr( "width", function(d) { return xObjScale(d.width ) } )
	.attr( "height", function(d) { return yObjScale(d.height ) } )
	.attr( "opacity", function(d) { return d.base.opacity } );
  var gtdata = svgContainer.selectAll( "text.groups" )
  gtdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.dispx) } )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height/2) } )
	.attr( "opacity", function(d) { return d.base.opacity } )
	.attr( "font-size", function(d) { return ""+Math.round(16 + xObjScale(textScale))+"px"} );

	////////////////// Pools /////////////////////////
  var pdata = svgContainer.selectAll( "rect.pools" )
  pdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.dispx - poolWidth/2)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + poolHeight/2)} )
	.attr( "opacity", function(d) { return d.base.opacity } )
	.attr( "width", xObjScale(poolWidth) )
	.attr( "height", yObjScale(poolHeight) );

  var tdata = svgContainer.selectAll( "text.pools" )
  tdata.transition()
	.duration(300)
	.attr( "x", function(d){return xScale(d.base.dispx-textXoffset * d.base.name.length) } )
	.attr( "y", function(d) {return yScale(d.base.dispy - 1 + poolHeight/2)} )
	.attr( "font-size", function(d) { return ""+Math.round(xObjScale(textScale))+"px"} )
	.attr( "opacity", function(d) { return d.base.opacity } );

	////////////////// reacs /////////////////////////
  var rdata = svgContainer.selectAll( ".reacs" )
  rdata.transition()
	.duration(300)
	.attr( "opacity", function(d) {return d.base.opacity} )
	.attr( "points", function(d) {return reacLineFunction( d.base.dispx, d.base.dispy ) } )

	////////////////// enzymes /////////////////////////
  var edata = svgContainer.selectAll( ".enzs" )
  edata.transition()
	.duration(300)
	.attr( "opacity", function(d) {return d.base.opacity} )
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )


	////////////////// MM enzymes /////////////////////////
  var medata = svgContainer.selectAll( ".mmenzs" )
  medata.transition()
	.duration(300)
	.attr( "opacity", function(d) {return d.base.opacity} )
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )

	////////////////// Messages /////////////////////////
  var mdata = svgContainer.selectAll( "line" )
  mdata.transition()
	.duration(300)
		.attr( "x1", function(d) {return xScale(d.calcX0) } )
		.attr( "y1", function(d) {return yScale(d.y0) } )
		.attr( "x2", function(d) {return xScale(d.x1) } )
		.attr( "y2", function(d) {return yScale(d.y1) } )
		.attr( "opacity", function(d) {return d.opacity} )
		.attr( "stroke-dasharray", function(d) {return d.dasharray} )
		.attr( "stroke-width", function(d) { return Math.round( xObjScale(arrowWidth) ) } );
}
/////////////////////////////////////////////////////////////////////////
