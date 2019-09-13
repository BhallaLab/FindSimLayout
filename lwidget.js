/////////////////////////////////////////////////////////////////
// lwidget29.js: Code to define chemical system in js for the purposes
// of layout and display in a browser
/////////////////////////////////////////////////////////////////

const pixelWidth = 700;
const pixelHeight = 700;
const layoutGroupWidth = 5;

var svgContainer = "";
var cx = 500.0;
var cy = 420.0;
var wx = 150;
var wy = 150;
/////////////////////////////////////////////////////////////////////
// Some system toggles.

var isZoomedOut = true;
var showProxies = false; // flag: decides if system should show proxies.
var autoPositionFlag = true;	// Get the system to auto-pos enzymes.
var positionEnzWithParent = false;	// If auto-positioning is on:
							// false: Place enz in same group as substrate
							// true: Place enz in same group as parent
/////////////////////////////////////////////////////////////////////

var textScale = 1.0;
const objSpacing = 0.6; // Worst case horizontal spacing of reacs and enz
var poolWidth = 6.0;
var poolHeight = 1.5;
var poolInterval= 1.5;	// Scale poolWidth for mid-point spacing of pools
var arrowWidth = 0.25;
var textXoffset = 0.3;
var enzYoffsetFromPool = 2.0;		// Scaling factor on PoolHeight
var enzYoffsetFromReagents = 3.0;	// Scaling factor on PoolHeight
var reacYoffsetFromReagents = 5.0;	// Scaling factor on PoolHeight
var poolYoffset = 8.0;				// Scaling factor on PoolHeight
const reacMsgColor = "green";
const groupFillColor = "cornsilk";
const groupBorderColor = "blue";
const groupTextColor = "darkblue";
const comptFillColor = "palegreen";

var displayError = function( msg ) {
}

var objLookup = {};
var nameLookup = {};
var centredGroup = "";

var poolData = [];
var reacData = [];
var enzData = [];
var mmEnzData = [];
var chanData = [];
var groupData = [];
var comptData = [];
var groupPlusComptData = [];
var funcData = [];
var msgData = [];
var poolProxies = [];
var reacProxies = [];
var foundEnzCoords = false;
var isMooseSBML = false;

var concUnits = "uM";
const concUnitScale = { "M": 1e-3, "mM": 1.0, "uM": 1000.0, "nM":1e6 };

/////////////////////////////////////////////////////////////////////////
// Some stuff for screen size scaling
/////////////////////////////////////////////////////////////////////////

function scaleFontsEtc( factor ) {
	textScale *= factor;
	poolWidth *= factor;
	poolHeight *= factor;
	arrowWidth *= factor;
	textXoffset *= factor;
}

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

function ChemObj( name, className, id, color, textfg, x, y, notes) {
		this.name = name;
		this.className = className;
		this.parentObj = "";
		this.id = id;
		this.fg = color;
		this.textfg = textfg;
		// this.opacity = 1;
		this.x = x;
		this.y = y;
		this.dispx = x;
		this.dispy = y;
		this.ndisp = 1;
		this.notes = "";
		this.wasDragged = false;
		this.selected = false; // When true, highlights by thick stroke
		this.deselected = false; // When true, dims the object
		this.visible = true; // When true, object is visible on screen
		this.getUniquePath = function() {
			if ( this.className == "Compt" || this.parentObj == "" || (typeof this.parentObj.base === "undefined" ) ) {
				return this.name;
			} else {
				return this.parentObj.base.getUniquePath() + "/"+this.name;
			}
		}
		Object.defineProperty( this, "opacity",
				{get: function() { return this.visible * (1.0 - this.deselected*0.7); } } );
}

function getSelectedAsString() {
	var ret = ""
	for ( const key in objLookup ) {
		var b = objLookup[key].base;
		if (b.selected) {
			ret += b.getUniquePath() + ",";
		}
	}
	return ret;
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

/////////////////////////////////////////////////////////////////
// Utility access functions that look for a field but return a sensible
// default if not found.

function annoGetFloat( anno, name, defaultValue ) {
	if (anno == "" )
		return defaultValue;
	var tag = anno.getElementsByTagName( name )
	if (tag && tag.length > 0) {
		return parseFloat( tag[0].textContent );
	}
	return defaultValue;
}

function annoGetStr( anno, name, defaultValue ) {
	if ( anno == "" )
		return defaultValue;
	var tag = anno.getElementsByTagName( name )
	if (tag && tag.length > 0) {
		return tag[0].textContent;
	}
	return defaultValue;
}

function annoGetBool( anno, name, defaultValue ) {
	if ( anno == "" )
		return defaultValue;
	var tag = anno.getElementsByTagName( name )
	if (tag && tag.length > 0) {
		var val = tag[0].textContent;
		if (val) {
			if (val.toLowerCase() == "true" || val != "0") {
				return true;
			}
			return false;
		}
	}
	return defaultValue;
}

function annoGetManno( anno, name ) {
	var val = anno.getElementsByTagName( name );
	return (val && val.length > 0) ? val[0] : "";
}

function attrGetFloat( attr, name, defaultValue ) {
	var item = attr.getNamedItem( name );
	if ( item == null )
		return defaultValue;
	return parseFloat( item.nodeValue );
}

function attrGetInt( attr, name, defaultValue ) {
	var item = attr.getNamedItem( name );
	if ( item == null )
		return defaultValue;
	return parseInt( item.nodeValue );
}

function attrGetBool( attr, name, defaultValue ) {
	var item = attr.getNamedItem( name );
	if ( item == null )
		return defaultValue;
	if ( item.toLowerCase == "true" ) return true;
	if ( item.toLowerCase == "false" ) return false;
	return defaultValue;
}

function attrGetStr( attr, name, defaultValue ) {
	var item = attr.getNamedItem( name );
	if ( item == null )
		return defaultValue;
	return item.nodeValue;
}

/////////////////////////////////////////////////////////////////
function makeBaseObj( className, xobj, anno, attr, annoName  ) {
	var id = attrGetStr( attr, "id", "dummy_id" );
	var name = attrGetStr( attr, "name", "" );
	if ( name == "" ) { // Old SBML
		name = id;
		name = name.replace( /_slash_/g, "__" );
		name = name.replace( /_minus_/g, "_" );
		name = name.replace( /_dot_/g, "_" );
		name = name.replace( /_star_/g, "_p" );
	}
	var x = 0.0;
	var y = 0.0;
	var textfg = "black";
	var bg = "cyan";
	var notes = "";
	// if ( typeof anno !== "undefined") {
	if ( anno.length > 0 ) {
		manno = annoGetManno( anno[0], annoName );
		if ( manno != "" ) {
			x = annoGetFloat( manno, "moose:xCord", 0.0 );
			y = annoGetFloat( manno, "moose:yCord", 0.0 );
			textfg = convColor( annoGetStr( manno, "moose:textColor", "black" ) );
			bg = convColor( annoGetStr(manno,"moose:bgColor", "cyan") );
			notes = annoGetStr( xobj, "notes", "" )
		}
	}
	return new ChemObj( name, className, id, bg, textfg, x,y, notes );
}

/////////////////////////////////////////////////////////////////


// This works on groups and compartments that are not inside any other.
function autoPositionTopLevelGroupsAndCompartments() {
	var k;
	var gc = [];
	var dx = poolInterval * poolWidth * (layoutGroupWidth + 1)
	for (k = 0; k < groupPlusComptData.length; k++ ) {
		x = groupPlusComptData[k];
		if ( x.base.parentObj == "" )
			gc.push(x);
	}
	currX = 0;
	currY = 0;
	for (k = 0; k < gc.length; k++ ) {
	// At this point we don't know how big the outer groups are actually
	// going to be: we can't assign absolute coords just yet.
	//	gc.base.dispx = gc.base.x = k % side;
	//	gc.base.dispy = gc.base.y = k / side;
		// Go through and set up child groups and other things in a 
		// square lattice. Each entry of it will assign space based on
		// a square of size (layoutGroupWidth +1) * poolWidth.
		// We assume that the reacs will be in the (0,0) grid place, and
		// the groups fill the rest.
		var kids = gc[k].groupAndComptChildren;
		var side = 1 + Math.floor( Math.sqrt( kids.length ) );
		var j;
		// Assume no deeper nesting.
		// Here we start with index 1 so that any reacns can occupy (0,0)
		for (j = 0; j < kids.length; j++ ) {
			kids[j].base.dispx = currX + dx * ((1+j) % side);
			kids[j].base.dispy = currY + dx * Math.floor((1+j) / side);
			kids[j].repositionGroup();
		}
		gc[k].updateCoords()
		currX += gc[k].width + poolWidth * 2;
	}
}


function GroupBase( id, name, compartment, parentObjId, bg, className = "Group" ) {
	this.compartment = compartment;
	this.parentObjId = parentObjId;
	this.base = new ChemObj( name, className, id, convColor(bg, 0.6), "yellow", 0,0, "" );
	this.width = poolWidth * 2;
	this.height = poolHeight * 2;
	this.children = []; // Array of Ids as strings. 
	this.groupAndComptChildren = []; // any group or compt children.
	this.poolChildren = []; // PoolObj in this group.
	this.reacChildren = []; // ReacObj in this group.
	this.enzChildren = []; // parent is a pool; positions NOT set by group.
	this.funcChildren = []; // parent is a pool; positioned right over pool
	this.enzAdoptees = []; // Parent may be on another group; Subs are local; positions ARE set by group.
	this.assignChildParents = function() {
		this.children = this.children.filter( function(value, idx, arr) {
			return typeof objLookup[ value ] !== "undefined";
		} );
		var k;
		for (k = 0; k < this.children.length ; k++ ) {
			objLookup[ this.children[k] ].base.parentObj = this; 
		}
	}
	this.addFuncChild = function( funcObj ) {
		this.funcChildren.push( funcObj.base.id );
	}
	this.addEnzChild = function( enzObj ) {
		this.enzChildren.push( enzObj.base.id );
	}
	this.addEnzAdoptee = function( enzObj ) {
		this.enzAdoptees.push( enzObj.base.id );
	}

	// Populates the subcategory arrays for pools, reacs, groups, compts
	this.subCategorizeChildren = function() {
		this.poolChildren = [];
		this.reacChildren = [];
		this.groupAndComptChildren = [];
		var k;
		for ( k = 0; k < this.children.length; k++ ) {
			obj = objLookup[this.children[k]];
			if ( obj.base.className == "Pool" )
				this.poolChildren.push( obj );
			else if (obj.base.className == "Reac" )
				this.reacChildren.push( obj );
			else if (obj.base.className == "Group" )
				this.groupAndComptChildren.push( obj );
			else if (obj.base.className == "Compt" )
				this.groupAndComptChildren.push( obj );
		}
	}
	this.updatePoolCoords = function() {
		if ( autoPositionFlag ) {
			var k;
			var num = this.poolChildren.length;
			var groupWidth = Math.max( 1, Math.min(num, layoutGroupWidth));
			var gx = this.base.x + 0.6 * poolWidth;
			var gy = this.base.y + poolHeight;
			for ( k = 0; k < this.poolChildren.length; k++ ) {
				var pool = this.poolChildren[k];
				pool.base.dispx = pool.base.x = gx + poolInterval * poolWidth*(k % groupWidth);
				pool.base.dispy = pool.base.y = gy + poolYoffset * poolHeight * Math.floor(k/groupWidth);
				pool.base.ypos = Math.floor(k/groupWidth);
			}
			for ( k = 0; k < this.funcChildren.length; k++ ) {
				var func = objLookup[this.funcChildren[k]];
				var pool = objLookup[func.tgtPool]
				func.base.dispx = func.base.x = pool.base.dispx;
				func.base.dispy = func.base.y = pool.base.dispy + poolHeight;
			}

		}
	}

	this.updateEnzCoords = function() {
		var k;
		if ( autoPositionFlag ) {
			if ( positionEnzWithParent ) {
				for ( k = 0; k < this.poolChildren.length; k++ ) {
					this.poolChildren[k].numEnzSites = 0;
				}
				this.enzChildren.forEach( autoPositionEnz );
			} else {
				this.enzAdoptees.forEach( autoPositionEnz );
				var ez = [];
				this.enzAdoptees.forEach( function( e ) { ez.push( objLookup[e] ) } );
				spaceOutObjectsOnGrid( ez );
				ez.forEach( function(e) { e.base.dispx = e.base.x; } );
			}
		}
	}


	this.updateCoords = function() {
		var k;
		var x = [];
		var y = [];
		var allkids = this.children.concat( this.funcChildren );
		if ( positionEnzWithParent ) {
			allkids = allkids.concat( this.enzChildren );
		} else {
			allkids = allkids.concat( this.enzAdoptees );
		}
		if ( autoPositionFlag ) {
			// this.updateEnzCoords();
			// This places reacs as per location of reagents.
			this.reacChildren.forEach( function(r) { autoPositionReac( r ) } );
			// This goes through them all and spaces out to avoid overlap
			spaceOutObjectsOnGrid( this.reacChildren );
			// Now put the final value in the dispx.
			this.reacChildren.forEach( function(r) { r.base.dispx = r.base.x; } );
		}
		for (k = 0; k < allkids.length ; k++ ) {
			var child = objLookup[ allkids[k] ]; 
			if ( child.base.className == "Group" || child.base.className == "Compt" ) {
				// Here we include the top right corner of the group.
				x.push( child.base.x + child.width );
				y.push( child.base.y + child.height );
			} 
			x.push( child.base.x );
			y.push( child.base.y );
		}
		if ( allkids.length > 0 ) {
			this.base.x = Math.min( ...x ) - 0.6*poolWidth; // Another dumb syntax.
			this.base.y = Math.min( ...y ) - poolHeight;
			this.base.dispx = this.base.x;
			this.base.dispy = this.base.y;
			this.width = 0.8 * poolWidth + Math.max( ...x ) - this.base.x;
			this.height = 2 * poolHeight + Math.max( ...y ) - this.base.y;
		}
	}

	this.repositionGroup = function() {
		//var dx = this.base.dispx - this.base.x - this.width/2;
		//var dy = this.base.dispy - this.base.y - this.height/2;
		var dx = this.base.dispx - this.base.x;
		var dy = this.base.dispy - this.base.y;
		var k;
		var allkids = this.children.concat( this.funcChildren );
		if ( positionEnzWithParent ) {
			allkids = allkids.concat( this.enzChildren );
		} else {
			allkids = allkids.concat( this.enzAdoptees );
		}
		for (k = 0; k < allkids.length ; k++ ) {
			var child = objLookup[ allkids[k] ]; 
			child.base.dispx += dx;
			child.base.dispy += dy;
				// This does very weird things. To avoid.
				// if ( child instanceof "GroupBase" ) 
			if ( isGroupOrCompt( child ) ) {
				child.repositionGroup();
			} else {
				child.base.x += dx;
				child.base.y += dy;
			}
		}
		this.base.x += dx;
		this.base.y += dy;

		// this.updateCoords();
	}

	this.setVisibility = function( visible ) {
		if (isZoomedOut) {
			var origVisibility = this.base.visible;
			this.base.visible = false;
			this.setChildVisibility( this.children );
			this.setChildVisibility( this.funcChildren );
			if (positionEnzWithParent ) {
				this.setChildVisibility( this.enzChildren );
			} else {
				this.setChildVisibility( this.enzAdoptees );
			}
			this.base.visible = visible;
		} else {
		// Even if opacity hasn't changed, child objects may have gained
		// or lost message links which affect their opacity. So we update
		// all regardless.
				/*
			if ( centredGroup == this ) { // Don't blank it
				visiblity = true;
			}
			*/
		// In all remaining cases, go through and set opacity recursively.
			this.base.visible = visible;
			this.setChildVisibility( this.children );
			this.setChildVisibility( this.funcChildren );
			if ( positionEnzWithParent ) {
				this.setChildVisibility( this.enzChildren );
			} else {
				this.setChildVisibility( this.enzAdoptees );
			}
		}
	}

	this.setChildVisibility = function( children ) {
		var j;
		for ( j = 0; j < children.length; j++ ) {
			child = objLookup[ children[j] ];
			//if ( !isGroupOrCompt( child ) ) {
			// Let the outer loop through groups handle child groups.
				child.base.visible = this.base.visible;
				child.base.dispx = 0;
				child.base.dispy = 0;
				child.base.ndisp = 0;
//			}
		}
	}

	this.setDeselect = function( flag ) {
		var j;
		var kids = this.children.concat( this.funcChildren, this.enzChildren );
		this.base.deselected = flag;
		for ( j = 0; j < kids.length; j++ ) {
			child = objLookup[ kids[j] ];
			if ( isGroupOrCompt( child ) ) {
				child.setDeselect( flag );
			} else {
				child.base.deselected = flag;
			}
		}
	}

	this.computeProxyLayout = function() {
		// for now a dummy function, just averages out the coords.
		computeGroupChildLayout( this.children );
		computeGroupChildLayout( this.funcChildren );
		if (positionEnzWithParent ) {
			computeGroupChildLayout( this.enzChildren );
		} else {
			computeGroupChildLayout( this.enzAdoptees );
		}
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
		document.getElementById( "isZoomedOut" ).checked = isZoomedOut;
		zoomVisibility();
		// Need to do the centredGroup here because zoomVisibility sets it.
		centredGroup = this;
		transition(svgContainer);
		// displayError( "zoomInOut on " + centredGroup.base.name );
	}
}

function GroupObj( xgroup, anno, attr ) {
	var id = attr.getNamedItem( "groups:id" ).nodeValue;
	var name = attr.getNamedItem( "groups:name" ).nodeValue;
	var manno = anno.getElementsByTagName("moose:GroupAnnotation");
	var compartment = annoGetStr( manno[0], "moose:Compartment", "" );
	var parentObjId = annoGetStr( manno[0], "moose:Parent", "" );
	var bg = annoGetStr( manno[0], "moose:bgColor", groupFillColor );
	var members = xgroup.getElementsByTagName("groups:member");

	GroupBase.call( this, id, name, compartment, parentObjId, bg, "Group");

	for (k = 0; k < members.length; k++ ) {
		var childId = members[k].attributes.getNamedItem( "groups:idRef" ).nodeValue;
		if (childId != null) 
			this.children.push( childId );
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
// Compartments contain other objects, including Groups and Compartments.
// These are all managed by the ComptObj, which derives from the GroupBase
//
/////////////////////////////////////////////////////////
function ComptObj( xcompt, anno, attr ) {
	var suffix = "_" + comptData.length.toString();
	var id = attrGetStr( attr, "id", "compt" + suffix );
	var name = attrGetStr( attr, "name", "compt" + suffix );
	// var id = attr.getNamedItem( "id" ).nodeValue;
	// var name = attr.getNamedItem( "name" ).nodeValue;
	var bg = comptFillColor;
	var compartment = "";
	var parentObjId = "";
	this.size = attrGetFloat( attr, "size", 1.0e-15 );
	this.spatialDimensions = attrGetFloat( attr, "spatialDimensions", 3 );
	if ( anno.length > 0 ) {
		var manno = annoGetManno( anno[0], "moose:CompartmentAnnotation" );
		this.shape = annoGetStr( manno, "moose:Mesh", "CubeMesh" );
		this.isMembraneBound = annoGetBool( manno, "moose:isMembraneBound", true );
		bg = annoGetStr( manno, "moose:bgColor", comptFillColor );
		compartment = annoGetStr( manno, "moose:compartment", "" );
		parentObjId = annoGetStr( manno, "moose:parent", "" );
	} else { // Put in the defaults
		this.shape = "CubeMesh";
		this.isMembraneBound = true;
	} 
	GroupBase.call( this, id, name, compartment, parentObjId, bg, "Compt");
	// this.size = parseFloat( attr.getNamedItem("size") );
	// this.spatialDimensions = parseInt( attr.getNamedItem("spatialDimensions") );
	// var compartment = manno[0].getElementsByTagName("moose:ContainedBy")[0].textContent;
	// var parentObj = manno[0].getElementsByTagName("moose:Parent")[0].textContent;
	
	this.addchild = function( child ) {
		this.children.push( child.base.id );
	}
}

function assignCompartments() {
	// Go through all Groups, put them in their Parents which will
	// either be another group or a Compartment.
	// Then go through all objects, check if their Parent is defined.
}

/////////////////////////////////////////////////////////

function PoolObj( xpool, anno, attr ) {
	this.base = makeBaseObj( "Pool", xpool, anno, attr, "moose:ModelAnnotation" );
	this.CoInit = concUnitScale[concUnits] * attrGetFloat(attr, "initialConcentration", 0.0 );
	this.isBuffered = attrGetBool(attr, "constant", false );
	this.diffConst = 0.0;
	this.motorConst = 0.0;
	this.numEnzSites = 0;
	this.compt = attrGetStr( attr, "compartment", "" );
	this.setComptObj = function() {
		if ( this.compt != "" )
			this.compt = objLookup[ this.compt ];
	}
	this.fallbackSetParent = function() {
		if ( this.base.parentObj == "" ) {
			if ( this.compt == "" ) // Bad!
				return;
			this.compt.children.push( this.base.id );
			this.base.parentObj = this.compt;
		}
	}
	
	if ( isMooseSBML && anno.length > 0 ) {
		var manno = annoGetManno( anno[0], "moose:ModelAnnotation" );
		this.diffConst = annoGetFloat( manno, "moose:diffConstant", 0.0 );
		this.motorConst = annoGetFloat( manno, "moose:motorConstant", 0.0);
	}
}

/////////////////////////////////////////////////////////

function addEnzSubToMsg( id, xenz, enzPool, fg ) {
	var xlist = xenz.getElementsByTagName( "listOfReactants" );
	var enzPa = "";
	var myMsgList = [];
	if (xlist.length > 0 ) {
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ) {
			var sattr = xpool[k].attributes;
			var pool = sattr.species.nodeValue;
			if (pool != enzPool ) { // Avoid parent pool of enzyme
				var numpool=sattr.getNamedItem( "stoichiometry" ).nodeValue;
				var msg = new MsgObj( "EnzSub", pool,  id,  numpool, fg );
				msgData.push( msg );
				myMsgList.push( msg );
			}
		}
	}
	return myMsgList;
}

function addEnzPrdToMsg( id, xenz, enzPool, fg ) {
	var xlist = xenz.getElementsByTagName( "listOfProducts" );
	var enzPa = "";
	var myMsgList = [];
	if (xlist.length > 0 ) {
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ) {
			var sattr = xpool[k].attributes;
			var pool = sattr.species.nodeValue;
			if (pool != enzPool ) { // Avoid parent molecule of enzyme
				var numpool=sattr.getNamedItem( "stoichiometry" ).nodeValue;
				var msg = new MsgObj( "EnzPrd", id,  pool,  numpool, fg );
				msgData.push( msg );
				myMsgList.push( msg );
			}
		}
	}
	return myMsgList;
}

function addReactantsToMsg( id, xreac, listName, msgName, fg ) {
	var xlist = xreac.getElementsByTagName( listName );
	var myMsgList = [];
	if (xlist.length > 0 ) {
		var startIdx = 0;
		var xpool = xlist[0].getElementsByTagName( "speciesReference" );
		var k;
		for (k = 0; k < xpool.length; k++ ){
			var sattr = xpool[k].attributes;
			// pool = sattr.getNamedItem( "species" ).nodeValue;
			var pool = sattr.species.nodeValue;
			var numpool = 1;
			var numPoolItem = sattr.getNamedItem( "stoichiometry" );
			if ( numPoolItem != null )
				numpool = numPoolItem.nodeValue;
			var msg;
			if ( msgName.indexOf( "Prd" ) != -1 ) {
				msg = new MsgObj( msgName, id,  pool,  numpool, fg );
			} else {
				msg = new MsgObj( msgName, pool,  id,  numpool, fg );
			}
			msgData.push( msg );
			myMsgList.push( msg );
		}
	}
	return myMsgList;
}

/////////////////////////////////////////////////////////
//
// Works for regular binding reaction.
function extractReacReagents( re ) {
	var paId = re.base.parentObj.base.id;
	var obj = [];
	var k;
	for ( k = 0; k < re.subs.length; k++ ) {
		sub = objLookup[re.subs[k].src];
		if ( sub.base.parentObj.base.id == paId )
			obj.push( sub );
	}
	for ( k = 0; k < re.prds.length; k++ ) {
		prd = objLookup[re.prds[k].dest];
		if ( prd.base.parentObj.base.id == paId )
			obj.push( prd );
	}
	return obj;
}

function spaceOutObjectsOnGrid( obj ) { 
	// Separates objects into sub-arrays, for each level of objects,
	// then spaces each level individually.
	const delta = poolHeight * 0.1;
	
	obj.sort( function( a, b ) { return a.base.y - b.base.y } );
	var lastobj = obj[0];
	var subArray = [];
	subArray.push( lastobj );
	var i;
	for ( i = 1; i < obj.length; i++ ) { 
		if ( ( obj[i].base.y - lastobj.base.y ) < delta ) {
			subArray.push( obj[i] );
		} else {
			spaceOutObjectsInX( subArray );
			lastobj = obj[i];
			subArray = [];
			subArray.push( lastobj );
		}
	}
	if ( subArray.length > 1 )
		spaceOutObjectsInX( subArray );
}

function spaceOutObjectsInX( obj ) { // takes array of objects, spreads out
	obj.sort( function( a, b ) { return a.base.x - b.base.x } );
	var mindx = poolWidth * objSpacing;
	var i;
	var j;
	var k = 0; // Loop cutoff if it doesn't converge.
	do {
		j = 0;
		for ( i = 1; i < obj.length; i++ ) { // start on 2nd object.
			var dx = obj[i].base.x - obj[i-1].base.x;
			if ( dx < mindx ) {
				obj[i-1].base.x -= (mindx -dx/2) * 0.3;
				obj[i].base.x += (mindx -dx/2) * 0.4;
				j++;
			}
		}	
		k++;
	} while (j > 0 && k < 20 );
}

function autoPositionReac( reacObj, xpos ) {
	// var reacObj = objLookup[reac];
	const xAvg = arr => arr.reduce((a, b) => a + b.base.x, 0) / arr.length;
	const yMin = arr => arr.reduce((a, b) => Math.min(a, b.base.y), 1.0e6);
	reacReagents = extractReacReagents( reacObj );
	reacObj.base.x = xAvg( reacReagents );
	reacObj.base.y = yMin( reacReagents ) + reacYoffsetFromReagents * poolHeight;
	// reacObj.base.dispx = reacObj.base.x; //Reassigned by spaceOutObjects
	reacObj.base.dispy = reacObj.base.y;
}

function ReacObj( xreac, anno, attr ) {
	this.base = makeBaseObj( "Reac", xreac, anno, attr, "moose:ModelAnnotation" );
	xparams = xreac.getElementsByTagName("localParameter");
	if (xparams.length > 0) { // Here we compute Kf and Kb for SI units
		this.innerKf = xparams[0].attributes.getNamedItem("value").nodeValue;
		if (xparams.length > 1) {
			this.innerKb = xparams[1].attributes.getNamedItem("value").nodeValue;
		}
	}
	this.subs = addReactantsToMsg( this.base.id, xreac, "listOfReactants", "ReacSub",reacMsgColor);
	this.prds = addReactantsToMsg( this.base.id, xreac, "listOfProducts", "ReacPrd", reacMsgColor);
	var cs = concUnitScale[ concUnits ];
	this.Kf = this.innerKf * Math.pow( cs, 1-this.subs.length );
	this.Kb = this.innerKb * Math.pow( cs, 1-this.prds.length );
	this.fallbackSetParent = function() {
		if ( this.base.parentObj == "" ) {
			var reactant = ""
			if ( this.subs.length > 0 ) {
				reactant = objLookup[this.subs[0].src]
			} else if ( this.prds.length > 0 ) {
				reactant = objLookup[this.prds[0].dest]
			} else {
				// Bad!
				throw( "Reaction " + this.base.id + " has neither substrates nor products." );
				
			}
			if ( reactant == "" || typeof reactant === "undefined" ) {
				throw( "Reactant not found for " + this.base.id );
			}
			var compt = reactant.base.parentObj;

			compt.children.push( this.base.id );
			this.base.parentObj = compt;
		}
	}
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
//
function extractEnzReagents( re ) {
	var obj = [];
	var k;
	for ( k = 0; k < re.subs.length; k++ ) {
		obj.push( objLookup[re.subs[k].src] );
	}
	for ( k = 0; k < re.prds.length; k++ ) {
		obj.push( objLookup[re.prds[k].dest] );
	}
	return obj;
}



// This works both for EnzObj and MMEnzObj
function autoPositionEnz( enz ) {
	var enzObj = objLookup[enz];
	if (positionEnzWithParent) {
		var ep = objLookup[ enzObj.enzPool ];
		ep.numEnzSites++;
		enzObj.base.x = ep.base.x;
		enzObj.base.y = ep.base.y + ep.numEnzSites * enzYoffsetFromPool* poolHeight;
	} else {
		const xAvg = arr => arr.reduce( (a, b) => a + b.base.x, 0 ) / arr.length;
		const yMax = arr => arr.reduce( (a, b) => Math.max(a, b.base.y), -1.0e6 );
		enzReagents = extractEnzReagents( enzObj );
		enzObj.base.x = xAvg( enzReagents );
		enzObj.base.y = yMax( enzReagents ) + enzYoffsetFromReagents * poolHeight;
	}
	enzObj.base.dispx = enzObj.base.x;
	enzObj.base.dispy = enzObj.base.y;
}

function EnzObj( xenz, anno, attr ) {
	this.base = makeBaseObj( "Enz", xenz, anno, attr, "moose:EnzymaticReaction" );
	var xparams = xenz.getElementsByTagName("localParameter");
	this.Km = 0.0;
	this.kcat = 0.0;
	this.enzPool = getEnzParent(xenz, anno[0] );
	if (xparams.length > 0) {
		this.K1 = parseFloat( xparams[0].attributes.getNamedItem("value").nodeValue );
		if (xparams.length > 1) {
			this.K2 = parseFloat( xparams[1].attributes.getNamedItem("value").nodeValue );
		}
	}
	this.prds = [];
	this.addProduct = function( xenz, anno, attr ) {
		var xparams = xenz.getElementsByTagName("localParameter");
		if (xparams.length > 0) {
			this.kcat = parseFloat( xparams[0].attributes.getNamedItem("value").nodeValue );
		}
		this.prds = addEnzPrdToMsg( this.base.id, xenz, this.enzPool, "red");
		this.Km = this.calcKm( concUnits );
	}
	this.subs = addEnzSubToMsg( this.base.id, xenz, this.enzPool, "red" );
	
	this.calcKm = function( concUnits ) {
		var scale = concUnitScale[ concUnits ];
		var innerKm = (this.kcat+ this.K2)/this.K1;
		return innerKm * Math.pow( scale, this.subs.length );
	}
}


/////////////////////////////////////////////////////////

function MMEnzObj( xenz, anno, attr, id, enzPool ) {
	this.base = makeBaseObj( "MMEnz", xenz, anno, attr, "moose:EnzymaticReaction" );
	this.enzPool = enzPool;
	this.kcat = 0.0;
	this.innerKm = 1.0;
	xparams = xenz.getElementsByTagName("localParameter");
	if (xparams.length >= 2) { // There must be a way to check id
		this.innerKm = parseFloat( xparams[0].attributes.getNamedItem("value").nodeValue );
		this.kcat = parseFloat( xparams[1].attributes.getNamedItem("value").nodeValue );
	}
	this.subs = addReactantsToMsg( this.base.id, xenz, "listOfReactants", "MMEnzSub", "blue" );
	this.prds = addReactantsToMsg( this.base.id, xenz, "listOfProducts", "MMEnzPrd", "blue" );
	this.Km = this.innerKm * Math.pow( concUnitScale[ concUnits ], this.subs.length );
}

////////////////////////////////////////////////////////////////////
function getPoolNameFromId( id ) {
	var s = id.split('_');
	var i;
	var ret = '';
	for ( i = 0; i < s.length - 3; i++) {
		if ( i > 0 ) {
			ret += '_';
		}
		ret += s[i];
	}
	return ret;
}

function FuncObj( tgtPool, argList ) {
	var funcName = getPoolNameFromId( tgtPool ) + "_func";
	// Later we may have more useful annotations on the Func, and if so we
	// can fill in more terms from the src SBML file.
	this.base = new ChemObj( funcName, "Func", tgtPool + "_func", "red", "maroon", 0, 0, "" );
	this.tgtPool = tgtPool;
	this.argList = argList;
	this.func = "Plus"; // Later put in arbitrary expression.
	
	this.addMsgs = function() {
		// Add the msgs for the object, also do first pass assignment of
		// its coords if these were pending at file load.
		var msg = new MsgObj( "FuncOutput", this.base.id, this.tgtPool, 1, "blue");
		msgData.push(msg );
		var i;
		for ( i = 0; i < this.argList.length; i++ ) {
			msg = new MsgObj( "FuncInput", this.argList[i], this.base.id, 1, "blue");
			msgData.push(msg );
		}
			/*
		if ( this.base.x == 0 && this.base.y == 0 ) {
			var tgtObjBase = objLookup[ this.tgtPool ].base;
			this.base.dispx = this.base.x = tgtObjBase.x;
			this.base.dispy = this.base.y = tgtObjBase.y + 5;
		}
		*/
	}
}

/// Utility function for 
function addMsgs( msg ) {
	msg.addMsgs();
}

/////////////////////////////////////////////////////////

function isObjVisible( obj ) {
	if ( obj.base.className == "Enz" || obj.base.className == "MMEnz" ) {
		if ( obj.subs.length > 0 ) {
			return objLookup[obj.subs[0].src].base.parentObj.base.visible;
		}
	} else {
		return obj.base.parentObj.base.visible;
	}
	return false;
}

function MsgObj( type, src, dest, stoichiometry, fg ) {
	this.type = type;
	this.src = src;	// String with Id of src
	this.dest = dest; // String with Id of dest
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
		this.visible = showProxies;
		// Note that the objects have multiple messages, so we need to 
		// logically combine opacity, not just assign it. Initial opacity
		// is set by group, and placeObjProxy sets to 1 if needed.
		if ( isObjVisible( srcObj ) ) {
			if ( isObjVisible( destObj ) ) {
				this.visible = true;
				this.dasharray = "";
			} else if (showProxies) { // grp of destObj is not visible
				this.dasharray = "3, 3";
				placeObjProxy( this.x0, this.y0, destObj );
			}
		} else { // Grp of srcObj is not visible
			if ( showProxies && isObjVisible( destObj ) ) {
				this.dasharray = "3, 3";
				placeObjProxy( this.x1, this.y1, srcObj );
			} else { // Neither obj group is visible.
				this.visible = false;
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
	obj.base.visible = true;
	if ( obj.base.className == "Pool" ) { // Place above
		obj.base.dispy += cy + wy/2 - poolHeight;
	} else { // Enz and reacs go below
		obj.base.dispy += cy - wy/2 + poolHeight / 2;
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

function parseCompts(xmlDoc) {
  var compts = xmlDoc.getElementsByTagName("compartment");
  var i;
  for (i = 0; i< compts.length; i++) {
	var anno = compts[i].getElementsByTagName("annotation")
	comptData.push( new ComptObj( compts[i], anno, compts[i].attributes ) );
  }
  groupPlusComptData = comptData.concat( groupData );
}

function parsePools(xmlDoc) {
  var pools = xmlDoc.getElementsByTagName("species");
  var i;
  for (i = 0; i< pools.length; i++) {
	var anno = pools[i].getElementsByTagName("annotation")
	if ( anno.length > 0 || isMooseSBML == false )
		// This excludes the enz complexes, which are only present in 
	    // MOOSE SBML and which have no annotations.
		poolData.push( new PoolObj( pools[i], anno, pools[i].attributes ));
  }
}

function parseFuncs(xmlDoc) {
  var funcs = xmlDoc.getElementsByTagName("assignmentRule");
  var i;
  for (i = 0; i < funcs.length; i++) {
	var tgtPool = funcs[i].attributes.getNamedItem( "variable" ).nodeValue;
  	var args = funcs[i].getElementsByTagName("ci");
	var argList = [];
	var j;
	for ( j = 0; j < args.length; j++ ) {
		s = args[j].textContent;
		argList.push( s.trim() );
	}
	funcData.push( new FuncObj( tgtPool, argList ) );
  }
}
/////////////////////////////////////////////////////////////////////////

// This function figures out if a reaction is a conversion one or an
// enzyme. We actually encode the information into the id for the reaction,
// and do so in one way for more recent models, and another for the old
// ones in doqcs. For now I'm using annotations which are a poor guide.
function reacType( reac, anno, attr ) {
	id = attr.getNamedItem("id").nodeValue;
	if ( typeof anno === "undefined" ) { // not MOOSE
		return [0, id]; // reac
	}
	if ( anno.getElementsByTagName("moose:ModelAnnotation").length > 0 ) {
		return [0, id]; // reac
	}
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
  var reacs = xmlDoc.getElementsByTagName("reaction");
  var i;
  for (i = 0; i< reacs.length; i++) {
	var anno = reacs[i].getElementsByTagName("annotation");
	var attr = reacs[i]. attributes;
 	try {
		ret = reacType( reacs[i], anno[0], attr );
	}
	catch (err) {
		displayError( err.message + ": Failed in parseReacs" );
		return;
	}
	if ( ret[0] == 0 ) {
		reacData.push( new ReacObj( reacs[i], anno, attr ) );
	} else if ( ret[0] == 1 ) {
		enzData.push( new EnzObj( reacs[i], anno, attr ) )
	} else if ( ret[0] == 2 ) {
		enzData[enzData.length -1].addProduct( reacs[i], anno, attr )
	} else if ( ret[0] == 3 ) {
		mmEnzData.push( new MMEnzObj( reacs[i], anno, attr, ret[1], ret[2] ) )
	}
  }
}
/////////////////////////////////////////////////////////////////////////

function clearAllArrays() {
	objLookup = {}; // Lengthy stack exchange discussion about how to clear
		// object. I leave it to the tender mercies of garbage collector.
	nameLookup = {};
	centredGroup = "";
	poolData.length = 0;
	reacData.length = 0;
	enzData.length = 0;
	mmEnzData.length = 0;
	chanData.length = 0;
	groupData.length = 0;
	comptData.length = 0;
	groupPlusComptData.length = 0;
	funcData.length = 0;
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

function loadXMLDoc( fn ) {
	clearAllArrays();
	var extn = fn.split('.').pop().toLowerCase();
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
		displayError( "File type unknown, no SBML or xml suffix." );
	}
}

function saveXMLDoc( fn ) {
	var s = new XMLSerializer();
	var xmlString = s.serializeToString( xmlDoc );
	
	
}

function parseSBML(xml) {
  var xmlDoc, txt;
  xmlDoc = xml.responseXML;
  var sbml = xmlDoc.getElementsByTagName( "sbml" );
  if ( typeof sbml === "undefined" ) {
	displayError( "File type unknown, no SBML header found." );
	return;
  }
  isMooseSBML = (attrGetStr( sbml[0].attributes, "xmlns:moose", "" ) !="");
  var txt = "";
  parsePools( xmlDoc );
  parseReacs( xmlDoc );
  parseGroups( xmlDoc );
  parseCompts( xmlDoc );
  parseFuncs( xmlDoc );
  txt += "Num Pools = " + poolData.length + "; ";
  txt += "Num Reacs = " + reacData.length + "<br>";
  txt += "Num Mass Action Enz = " + enzData.length + "; ";
  txt += "Num MM Enz = " + mmEnzData.length + "<br>";
  txt += "Num Groups = " + groupData.length + ", Num Compts = " + comptData.length + "<br>";
  txt += "Num Funcs = " + funcData.length + "; ";
  txt += "Num Msgs = " + msgData.length + ", visible = " + msgData.length + "<br>";
  displayError( txt );
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
	comptData.forEach( addObjToLookup );
	funcData.forEach( addObjToLookup );
	makeNameLookup();
	zoomToEntireModel();

	poolData.forEach( function( pool ) { pool.setComptObj() } );
	groupData.forEach( function( grp ) { grp.assignChildParents() } );
	comptData.forEach( function( grp ) { grp.assignChildParents() } );
	poolData.forEach( function( pool ) { pool.fallbackSetParent() } );
	reacData.forEach( function( reac ) { reac.fallbackSetParent() } );
	groupData.forEach( assignGroupParents );
	comptData.forEach( assignGroupParents );
	groupData.forEach( function( grp ) { grp.subCategorizeChildren() } );
	comptData.forEach( function( grp ) { grp.subCategorizeChildren() } );
	enzData.forEach( addEnzToGroup );
	mmEnzData.forEach( addEnzToGroup );
	funcData.forEach( addFuncToGroup );
	groupData.forEach( function( grp ) { grp.updatePoolCoords() } );
	comptData.forEach( function( grp ) { grp.updatePoolCoords() } );
	groupData.forEach( function( grp ) { grp.updateEnzCoords() } );
	comptData.forEach( function( grp ) { grp.updateEnzCoords() } );
	groupData.forEach( function( grp ) { grp.updateCoords() } );
	comptData.forEach( function( grp ) { grp.updateCoords() } );
	autoPositionTopLevelGroupsAndCompartments();
	funcData.forEach( addMsgs );
}

// Here we come in with the parentObj as a string, unless it has already
// been assigned. In which case we don't need to assign it.
function assignGroupParents( obj ) {
	if ( obj.base.className == "Group" && obj.base.parentObj == "" ) {
	// Fallback to compartment in cases where group hasn't defined parent
		if ( obj.compartment != "" ) {
			obj.parentObjId = obj.compartment;
		}
	}
	if ( obj.base.parentObj == "" && obj.parentObjId != "" ) {
		var pa = objLookup[ obj.parentObjId ];
		if (typeof pa !== "undefined" ) {
			obj.base.parentObj = pa;
			pa.children.push( obj.base.id );
		}
	}
}

function makeNameLookup() {
	var names = [];
	// First, find the unique object names
	for (var key in objLookup ) {
		if ( objLookup.hasOwnProperty( key ) ) {
			names.push( objLookup[key].base.name )
		}
	}
	// objLookup.forEach ( function ( obj ) { names.push(obj.base.name); } );
	// Another marvellous JavaScript syntax gem.
	var uniqueNames = [...new Set( names ) ];
	
	// Then, build assoc array nameLookup, containing array of objects with that name.
	uniqueNames.forEach( function (n ) { nameLookup[n] = []; } );

	for (var key in objLookup ) {
		if ( objLookup.hasOwnProperty( key ) ) {
			var obj = objLookup[key]
			nameLookup[ obj.base.name ].push( obj );
		}
	}

	// objLookup.forEach( function ( obj ) { nameLookup[obj.base.name].push( obj ); } );
	
}

function addObjToLookup( obj ) {
	objLookup[ obj.base.id ] = obj;
}

/*
function assignChildParents( grp ) {
	grp.assignChildParents()
}
*/

function addEnzToGroup( enz ) {
	// This does two things: 
	// 1. Put enz on its pool's parent group in enzChildren,
	// 2. Put enz on its substrate's parent group in enzAdoptees.
	enzPool = objLookup[enz.enzPool];
	if ( typeof enzPool === "undefined"  ) {
			alert( "addEnzToGroup, failed; not in objLookup" );
	}
	if ( typeof enzPool === "undefined" || typeof enzPool.base.parentObj.base === "undefined" ) {
			alert( "addEnzToGroup, failed" );
	}
	enz.base.parentObj = enzPool.base.parentObj;
	enz.base.parentObj.addEnzChild( enz );
	
	// 2. Enz substrate
	if ( enz.subs.length == 0 )  {
		alert( "addEnzToGroup, failed to find any substrates." );
		return;
	}

	subPool = objLookup[enz.subs[0].src];
	subPool.base.parentObj.addEnzAdoptee( enz );
}

function addFuncToGroup( func ) {
	funcPool = objLookup[func.tgtPool];
	if ( typeof funcPool === "undefined"  ) {
			alert( "addFuncToGroup, failed; not in objLookup" );
	}
	func.base.parentObj = funcPool.base.parentObj;
	func.base.parentObj.addFuncChild( func );
	func.base.name = funcPool.base.name + "_func";
	func.base.dispx = func.base.x = funcPool.base.x;
	func.base.dispy = func.base.y = funcPool.base.y + 5;
}
/////////////////////////////////////////////////////////////////////////
// Making the svg stuff for web page
/////////////////////////////////////////////////////////////////////////
	
function reacLineFunction( x, y ) {
	var z = textScale;
	var ret =
	xScale(x-0.8*z).toFixed(2) + "," + yScale(y-z).toFixed(2) + " " +
	xScale(x-1.6*z).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+1.6*z).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+0.8*z).toFixed(2) + "," + yScale(y+z).toFixed(2);
	return ret;
}

function enzLineFunction( x, y ) {
	var z = textScale;
	var ret =
	xScale(x).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x+z).toFixed(2) + "," + yScale(y+0.5*z).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y+0.8*z).toFixed(2) + " " +
	xScale(x-1.6*z).toFixed(2) + "," + yScale(y).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y-0.8*z).toFixed(2) + " " +
	xScale(x+z).toFixed(2) + "," + yScale(y-0.5*z).toFixed(2) + " " +
	xScale(x).toFixed(2) + "," + yScale(y).toFixed(2);
	return ret;
}
	
function zoomVisibility() {
	var j;
	var minR = 1e6;
	var vis = [];
	for ( j = 0; j < groupPlusComptData.length; j++ ) {
		var grp = groupPlusComptData[j];
		var dx = grp.base.x + grp.width/2.0 - cx;
		var dy = grp.base.y + grp.height/2.0 - cy;
		var r = Math.sqrt( dx*dx + dy*dy );
		vis.push( (r + poolWidth) < (wx + wy)/4 );
		if ( minR > r ) {
			minR = r;
			centredGroup = grp;
		}
	}
	for ( j = 0; j < groupPlusComptData.length; j++ ) {
		groupPlusComptData[j].setVisibility( vis[j] );
	}
	
	msgData.forEach( function( msg ) { msg.rawTermini()  } );
	msgData.forEach( function( msg ) { msg.setProxyAndOpacity()  } );
	poolProxies.length = 0;
	reacProxies.length = 0;
	groupPlusComptData.forEach( function( grp ) { grp.computeProxyLayout() } );
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

function nozoom() {
  d3.event.preventDefault();
}

function invertEventCoords() {
  // x = xScale.invert(d3.event.sourceEvent.pageX);
  // x = yScale.invert(d3.event.sourceEvent.offsetY);
  // y = yScale.invert(d3.event.sourceEvent.offsetY);
  x = xScale.invert(d3.event.x);
  y = yScale.invert(d3.event.y);
  return [x, y];
  // return [d3.event.x, d3.event.y];
}

function isGroupOrCompt( obj ) {
	if ( obj == "" ) return false;
	return ( obj.base.className == "Group" || obj.base.className == "Compt" );
}

function dragged(d) {
  var inv = invertEventCoords();
  d.base.wasDragged = true;
  displayError( "raw=(" + d3.event.x.toFixed(2) + ", " + d3.event.y.toFixed(2) + "); cooked = (" + inv[0].toFixed(2) + ", " + inv[1].toFixed(2) + "); Orig = (" + d.base.x.toFixed(2) + ", " + d.base.y.toFixed(2) + ")" );
  if ( isZoomedOut && isGroupOrCompt(d) ) { // Only groups can move.
  	d.base.dispx = inv[0];
  	d.base.dispy = inv[1];
	
		  /*
  	var svgContainer = d3.select("body").select("svg");
	groupTransition( svgContainer );
	*/
  	d3.select(this)
	.attr( "x", function(d) {return xScale(d.base.dispx)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height)} );
  }
  if ( !(isZoomedOut || isGroupOrCompt(d) ) ) {
  	d.base.dispx = inv[0];
  	d.base.dispy = inv[1];
  	d.base.x = inv[0];
  	d.base.y = inv[1];
  	if (d.base.className == "Reac" ) {
  		d3.select(this).attr( "points", function(d) {return reacLineFunction( d.base.dispx, d.base.dispy ) } );
  	} else if (d.base.className == "Pool" ) {
  		d3.select(this)
	  	.attr("x", function(d) {return xScale(d.base.dispx - poolWidth/2)})
  	  	.attr("y", function(d) {return yScale(d.base.dispy + poolHeight/2)} );
  	} else if (d.base.className == "Enz" || d.base.className == "MMEnz" ) {
  		d3.select(this).attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } );
  	} else if (d.base.className == "Func" ) {
  		d3.select(this)
	  	.attr( "cx", function(d) {return xScale( d.base.dispx ) } )
  	  	.attr( "cy", function(d) {return yScale( d.base.dispy - 1 + poolHeight/2) } );
	}
  } 
  d3.event.sourceEvent.stopPropagation();
}

var drag = d3.behavior.drag()
  .origin( function(d) { return {x:xScale(d.base.dispx), y:yScale(d.base.dispy) }; } )
  .on( "drag", dragged )
  .on( "dragend", function(d) {
	displayError( "Calling dragend for " + d.base.name );
	if ( d.base.wasDragged ) {
		displayError( "Finished calling dragend for " + d.base.name );
		d.base.wasDragged = false;
		if ( isZoomedOut && isGroupOrCompt(d) ) {
			d.repositionGroup();
		}
		if ( !(isZoomedOut || isGroupOrCompt(d) ) ) {
    		zoomVisibility();
		}
		if ( d.base.className == "Enz" || d.base.className == "MMEnz" ) {
			if ( d.subs.length > 0 ) {
				grp = objLookup[d.subs[0].src].base.parentObj;
				// Update PoolCoords?
				grp.updateEnzCoords();
				grp.updateCoords();
			}
		} else {
			if ( isGroupOrCompt(d.base.parentObj) ) {
				d.base.parentObj.updateCoords();
			}
		}
  		var svgContainer = d3.select("body").select("svg");
		transition( svgContainer );
	}
  } );

//////////////////////////////////////////////////////////////////////////
function copyToClipboard( val ) {
	const el = document.createElement("textarea");
	el.textContent = val;
	el.style.position = "fixed";
	el.style.left = "-9999px";
	document.body.appendChild(el);
	el.select();
	document.execCommand('copy');
	document.body.removeChild(el);
}


function dblclicked(d) {
	if (d3.event.defaultPrevented) return; // dragged
	d.base.selected = false;
	d3.select(this)
		.attr( "stroke-width", "2" );
	copyToClipboard( getSelectedAsString() );
	d.zoomInOut();
}

function clicked(d) {
  if (d3.event.defaultPrevented) return; // dragged
  if ( d.base.selected ) {
	d.base.selected = false;
  	d3.select(this).transition()
	  	.attr( "stroke-width", "2" );
  } else {
	d.base.selected = true;
  	d3.select(this).transition()
	  	.attr( "stroke-width", "10" );
  }
  copyToClipboard( getSelectedAsString() );
}
//////////////////////////////////////////////////////////////////////////

function doLayout() {
  var svgContainer = d3.select("body")
	.append("svg")
	.attr( "width", pixelWidth )
	.attr( "height", pixelHeight )
	.attr( "focusable", false )
	.style( "border", "3px solid blue")
	.style( "background-color", "lightblue")
  // svgContainer.selectAll( "svg" )
  // svgContainer.enter()
  // d3.select("body").selectAll( "svg" )
  d3.select("body")
	.on( "touchstart", nozoom)
	.on( "touchmove", nozoom)
	.on("keydown", function() {
		if (d3.event.srcElement.localName == "body") {
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
		} else if (kc == 80) { // p or P, for toggling proxy display.
			showProxies = !showProxies;
			document.getElementById("showProxies").checked = showProxies;
		} else if (kc == 187) { // + or =, for increasing font size.
			scaleFontsEtc( 1.1 );
		} else if (kc == 189) { // - or _, for decreasing font size.
			scaleFontsEtc( 0.9 );
		}
		setDisplayScales();

		displayError( "Coords:(" + cx.toFixed(2) + "," + cy.toFixed(2) + "), window = (" + wx.toFixed(2) + "," + wy.toFixed(2) + ")" );
		zoomVisibility();

		transition(svgContainer);
		}
	})
	.on( "focus", function(){} );

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
		.style( "top", (d3.event.pageY - 58 ) + "px" );
}

function enzMouseOver( div, d ) {
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
	div.html( enzPath + "<br/>Km= " + d.Km.toPrecision(3) + 
		"<br/>kcat= " + d.kcat.toPrecision(3) )
		.style( "left", (d3.event.pageX) + "px")
		.style( "top", (d3.event.pageY - 58 ) + "px" );
}

function funcMouseOver( div, d ) {
	div.transition()
		.duration(200)
		.style("opacity", 0.9);
	div.html( d.base.name + "<br/>Func: " + d.func )
		.style( "left", (d3.event.pageX) + "px")
		.style( "top", (d3.event.pageY - 58 ) + "px" );
}

function redraw( svgContainer ) {
  zoomVisibility(); // Update all the object opacity settings.
  var div = d3.select("body").append("div")
	.attr( "class", "tooltip" )
	.style( "opacity", 0);

  var gdata = svgContainer.selectAll( ".groups" )
	.data( groupPlusComptData )

  var group = gdata.enter().append("rect").attr("class", "groups" );

  var groupIcons = group
	.attr( "x", function(d) {return xScale(d.base.dispx)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height )} )
	.attr( "width", function(d) { return xObjScale(d.width ) } )
	.attr( "height", function(d) { return yObjScale(d.height ) } )
	// .attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke", groupBorderColor )
	.attr( "stroke-width", "2" )
	.attr( "fill", function(d) {return d.base.fg} )
	//.on( "dblclick", function(d) { clicked(d); d.zoomInOut(); } )
	.on( "dblclick", dblclicked )
	.on( "click", clicked)
	.call( drag );

  var groupText = gdata.enter().append( "text" )
	.classed( 'noselect', true )
	.attr( "class", "groups" )
	.attr( "x", function(d) {return xScale(d.base.dispx) } )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height/2) } )
	.attr( "font-family", "sans-serif" )
	.attr( "font-size", function(d) { return ""+Math.round(16 + xObjScale(textScale))+"px"} )
	.attr( "fill", groupTextColor )
	.text( function(d){return d.base.name} );
	// .on( "dblclick", function(d) { d.zoomInOut() } );

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
	.attr( "stroke-dasharray", function(d) {return (d.isBuffered ? "3, 3" : "")} )
	.attr( "stroke-width", function(d) {return (d.i10sBuffered ? 5: 1)} )
	.on( "mouseover", function(d) { poolMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	})
	.on( "click", clicked)
	.call( drag );

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
	})
	.on( "click", clicked)
	.call( drag );

  pdata.exit().remove();

///////////////////////////////////
  var rdata = svgContainer.selectAll( ".reacs" )
	.data( reacData )
  var reac = rdata.enter().append("polyline").attr("class", "reacs");

  var reacIcons = reac
	.attr( "points", function(d) {return reacLineFunction( d.base.dispx, d.base.dispy ) } )
	//.attr( "stroke", function(d) { return d.base.parentObj.base.fg  }  )
	.attr( "stroke", "blue" )
	.attr( "stroke-width", "2" )
	// .attr( "fill", "none" )
	.attr( "fill", "cornsilk" )
	//.attr( "transform", function(d) {return "translate(" + d + ")"; })
	.on( "mouseover", function(d) { 
		div.transition()
			.duration(200)
			.style("opacity", 0.9);
		div.html( "Kf= " + d.Kf.toPrecision(3) + 
			"<br/>Kb = " + d.Kb.toPrecision(3) + 
			"<br/>" + d.base.name )
			.style( "left", (d3.event.pageX) + "px")
			.style( "top", (d3.event.pageY - 58 ) + "px" );
	} )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	})
	.on( "click", clicked)
	.call( drag );

  rdata.exit().remove();
///////////////////////////////////

  var edata = svgContainer.selectAll( ".enzs" )
	.data( enzData )

  var enz = edata.enter().append("polyline").attr("class", "enzs");

  var enzIcons = enz
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )
	.attr( "stroke", "black" )
	.attr( "stroke-width", "1" )
	.attr( "fill", function(d) {return d.base.fg} )
	.on( "mouseover", function(d) { enzMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	})
	.on( "click", clicked)
	.call( drag );

  edata.exit().remove();
///////////////////////////////////

  var medata = svgContainer.selectAll( ".mmenzs" )
	.data( mmEnzData )

  var mmenz = medata.enter().append("polyline").attr("class", "mmenzs");

  var mmenzIcons = mmenz
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )
	.attr( "stroke", function(d) {return d.base.fg} )
	.attr( "stroke-width", "2" )
	.attr( "fill", "none" )
	.on( "mouseover", function(d) { enzMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	})
	.on( "click", clicked)
	.call( drag );

  medata.exit().remove();
///////////////////////////////////

  var mdata = svgContainer.selectAll( "line" )
	.data( msgData )

  var msgs = mdata
	.enter()
	.append("line")
		.attr( "class", "arrow" )
		.attr( "stroke", function(d) {return d.fg} )
		.attr( "stroke-width", function(d) { return xObjScale(arrowWidth)} )
		.attr( "marker-end", function(d) {return d.markerURL } )
		.attr( "x1", function(d) {return xScale(d.calcX0) } )
		.attr( "y1", function(d) {return yScale(d.y0) } )
		.attr( "x2", function(d) {return xScale(d.x1) } )
		.attr( "y2", function(d) {return yScale(d.y1) } )
		.attr( "opacity", function(d) {return d.opacity} );
	// Turns out d3 doesn't have a way to change marker color. So we need
	// separate markers to represent each color. Stupid.
  mdata.exit().remove();

////////////////////////// Funcs //////////////////////////////////////
  var fdata = svgContainer.selectAll( ".funcs" )
	.data( funcData )
  var funcIcons = fdata.enter().append("circle")
	.attr( "class", "funcs" )
	.attr( "cx", function(d){return xScale(d.base.dispx) } )
	.attr( "cy", function(d) {return yScale(d.base.dispy)} )
	.attr( "r", function(d) {return xObjScale(poolHeight)} )
	.attr( "fill", function(d) {return d.base.textfg} )
	.attr( "stroke", function(d) {return d.base.textfg} )
	.attr( "stroke-width", 1 )
	.on( "mouseover", function(d) { funcMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	})
	.on( "click", clicked)
	.call( drag );

	/*
  var funcIcons = fdata.enter().append("text")
	.attr("class", "funcs" )
	.attr( "x", function(d){return xScale(d.base.dispx) } )
	.attr( "y", function(d) {return yScale(d.base.dispy - 1 + poolHeight/2)} )
	.attr( "font-family", "sans-serif" )
	.attr( "font-size", function(d) { return ""+Math.round(xObjScale(textScale))+"px"} )
	.attr( "fill", function(d){return d.base.textfg} )
	.text( function(d){return d.func} )
	.on( "mouseover", function(d) { funcMouseOver( div, d ) } )
	.on( "mouseout", function(d) {
		div.transition().duration(500).style( "opacity", 0.0);
	})
	.on( "click", clicked)
	.call( drag );
	*/

  fdata.exit().remove();
}

/////////////////////////////////////////////////////////////////////////
// Here we define the transitions.
/////////////////////////////////////////////////////////////////////////
function groupTransition( svgContainer ) {
  var gdata = svgContainer.selectAll( "rect.groups" )
  gdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.dispx)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height)} )
	.attr( "width", function(d) { return xObjScale(d.width ) } )
	.attr( "height", function(d) { return yObjScale(d.height ) } )
	.attr( "stroke-width", function(d) {return (d.base.selected ? 10: 2)} )
	.attr( "opacity", function(d) { return d.base.opacity } );
  var gtdata = svgContainer.selectAll( "text.groups" )
  gtdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.dispx) } )
	.attr( "y", function(d) {return yScale(d.base.dispy + d.height/2) } )
	.attr( "opacity", function(d) { return d.base.opacity } )
	.attr( "font-size", function(d) { return ""+Math.round(16 + xObjScale(textScale))+"px"} );
}

function transition( svgContainer ) {
	////////////////// groups /////////////////////////
	groupTransition( svgContainer );

	////////////////// Pools /////////////////////////
  var pdata = svgContainer.selectAll( "rect.pools" )
  pdata.transition()
	.duration(300)
	.attr( "x", function(d) {return xScale(d.base.dispx - poolWidth/2)} )
	.attr( "y", function(d) {return yScale(d.base.dispy + poolHeight/2)} )
	.attr( "opacity", function(d) { return d.base.opacity } )
	.attr( "stroke-dasharray", function(d) {return (d.isBuffered ? "3, 3" : "" )} )
	.attr( "stroke-width", function(d) {return Math.max(d.isBuffered * 5, (d.base.selected ? 10: 1) )} )
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
	.attr( "stroke-width", function(d) {return (d.base.selected ? 10: 2)} )
	.attr( "points", function(d) {return reacLineFunction( d.base.dispx, d.base.dispy ) } )

	////////////////// enzymes /////////////////////////
  var edata = svgContainer.selectAll( ".enzs" )
  edata.transition()
	.duration(300)
	.attr( "opacity", function(d) {return d.base.opacity} )
	.attr( "stroke-width", function(d) {return (d.base.selected ? 10: 1)} )
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )


	////////////////// MM enzymes /////////////////////////
  var medata = svgContainer.selectAll( ".mmenzs" )
  medata.transition()
	.duration(300)
	.attr( "opacity", function(d) {return d.base.opacity} )
	.attr( "stroke-width", function(d) {return (d.base.selected ? 10: 1)} )
	.attr( "points", function(d) {return enzLineFunction( d.base.dispx, d.base.dispy ) } )

	////////////////// Messages /////////////////////////
  var mdata = svgContainer.selectAll( "line" )
  mdata.transition()
	.duration(300)
		.attr( "x1", function(d) {return xScale(d.calcX0) } )
		.attr( "y1", function(d) {return yScale(d.y0) } )
		.attr( "x2", function(d) {return xScale(d.x1) } )
		.attr( "y2", function(d) {return yScale(d.y1) } )
		.attr( "opacity", function(d) {return d.opacity * d.visible} )
		.attr( "stroke-dasharray", function(d) {return d.dasharray} )
		.attr( "stroke-width", function(d) { return Math.round( xObjScale(arrowWidth) ) } );
/////////////////////////////////////////////////////////////////////////
  var fdata = svgContainer.selectAll( "circle.funcs" );

  fdata.transition()
	.duration(300)
	.attr( "cx", function(d){return xScale(d.base.dispx ) } )
	.attr( "cy", function(d) {return yScale(d.base.dispy)} )
	.attr( "r", function(d) {return xObjScale(poolHeight)} )
	//.attr( "font-size", function(d) { return ""+Math.round(xObjScale(textScale))+"px"} )
	.attr( "stroke-width", function(d) {return (d.base.selected ? 10: 1)} )
	.attr( "opacity", function(d) { return d.base.opacity } );
/////////////////////////////////////////////////////////////////////////
}

////////////////////////////////////////////////////////////////////////
// API calls
////////////////////////////////////////////////////////////////////////

function checkParentage( obj, names ) {
	var pa = obj.base.parentObj;
	for ( var i = names.length-2; i >= 0; i-- ) {
		if ( pa == "") return 0; // Shouldn't happen
		if ( pa.base.name != names[i] ) return 0;
		pa = pa.base.parentObj;
	}
	return 1; // Reached end of names array without problems.
}

function convPathToObj( path ) {
	var names = path.split( "/" );
	if ( names.length == 0 ) return ""; // No names at all
	nl = nameLookup[ names[ names.length-1 ] ];
	if (nl.length == 0 ) return ""; // No matches at leaf
	var numMatches = 0;
	var match;
	for ( var i = 0; i < nl.length; i++ ) {
		if ( checkParentage( nl[i], names ) ) {
			numMatches++;
			match = i;
		}
	}
	if ( numMatches == 1 ) {
		return nl[match];
	} else if ( numMatches == 0 ) {
		return ""; // No matches with provided path
	}
	return "" // Non-unique matches.
}

// Set selection status of objects. Anything listed here is selected.
// Does not go recursively. Clears out previous selections.
function apiSelect( pathStr  ) {
	var pathVec = pathStr.split( ',' );
	var q = "";
	//objLookup.forEach( function ( obj ) { obj.base.selected = false;} );
	for (var key in objLookup ) {
		if ( objLookup.hasOwnProperty( key ) ) {
				objLookup[key].base.selected = false;
		}
	}
	var numSelected = 0;
	pathVec.forEach( function( p ) { 
		if ( p != "" ) {
			q = convPathToObj( p ); 
			if (q != "") {
				q.base.selected = true;
				numSelected++;
			}
		}
	} );
	if ( numSelected > 0 ) {
  		var svgContainer = d3.select("body").select("svg");
		transition( svgContainer );
	}
}


// Set selection status of objects. Anything NOT listed here is 
// deselected.
// Selects stuff recursively: all child objects are selected unless
// explicitly removed.
function apiSetSubset( pathStr  ) {
	var pathVec = pathStr.split( ',' );
	var q = "";
	//objLookup.forEach( function ( obj ) { obj.base.selected = false;} );
	for (var key in objLookup ) {
		if ( objLookup.hasOwnProperty( key ) ) {
				objLookup[key].base.deselected = true;
		}
	}
	var numSelected = 0;
	pathVec.forEach( function( p ) { 
		if ( p != "" ) {
			q = convPathToObj( p ); 
			if (q != "") {
				if ( isGroupOrCompt( q ) ) {
					q.setDeselect( false );
				} else {
					q.base.deselected = false;
				}
				numSelected++;
			}
		}
	} );
	if ( numSelected > 0 ) {
  		var svgContainer = d3.select("body").select("svg");
		transition( svgContainer );
	}
}

// Similar to above, but now it deselects everything ON the list.
// Unlike the setSubset, it does NOT clear the list beforehand.
function apiRemoveItems( pathStr ) {
	var pathVec = pathStr.split( ',' );
	var q = "";
	var numDeselected = 0;
	pathVec.forEach( function( p ) { 
		q = convPathToObj( p ); 
		if (q != "") {
			if ( isGroupOrCompt( q ) ) {
				q.setDeselect( true );
			} else {
				q.base.deselected = true;
			}
			numDeselected++;
		}
	} );
	if ( numDeselected > 0 ) {
  		var svgContainer = d3.select("body").select("svg");
		transition(svgContainer);
	}
}

function apiClearSelected() {
	for (var key in objLookup ) {
		if ( objLookup.hasOwnProperty( key ) ) {
			var base = objLookup[key].base;
			base.deselected = base.selected = false;
		}
	}
 	var svgContainer = d3.select("body").select("svg");
	transition(svgContainer);
}

function apiSetErrorCallback( ec ) {
	displayError = ec;
}

function apiSetZoom( state ) {
	// Need to know which group to zoom in and out
	isZoomedOut = !state;
	if (centredGroup != "")
		centredGroup.zoomInOut();
	// redraw( svgContainer );
	// zoomVisibility();
	// transition( svgContainer );
}

function apiSetProxies( state ) {
	// global showProxies;
	showProxies = state;
	displayError( "Showing Proxies " + state.toString() );
	zoomVisibility();
	transition(svgContainer);
}

function apiSetAutoPositionDisplay( state ) {
	autoPositionFlag = state;
	if ( autoPositionFlag ) {
		groupPlusComptData.forEach( function( grp ) { grp.updatePoolCoords() } );
		groupPlusComptData.forEach( function( grp ) { grp.updateEnzCoords() } );
		groupPlusComptData.forEach( function( grp ) { grp.updateCoords() } );
	}
	displayError( "Setting autoEnzPosition: " + state.toString() );
}

function apiSetPositionEnzWithParent( state ) {
	positionEnzWithParent = state;
	if ( autoPositionFlag ) {
		groupPlusComptData.forEach( function( grp ) { grp.updatePoolCoords() } );
		groupPlusComptData.forEach( function( grp ) { grp.updateEnzCoords() } );
		groupPlusComptData.forEach( function( grp ) { grp.updateCoords() } );
	}
	// zoomVisibility();
	transition(svgContainer);
	displayError( "Setting positionEnzWithPa: " + state.toString() );
}
