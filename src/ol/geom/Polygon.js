/**
 * @module ol/geom/Polygon
 */
import {inherits} from '../index.js';
import {extend} from '../array.js';
import {closestSquaredDistanceXY, getCenter} from '../extent.js';
import GeometryLayout from '../geom/GeometryLayout.js';
import GeometryType from '../geom/GeometryType.js';
import LinearRing from '../geom/LinearRing.js';
import Point from '../geom/Point.js';
import SimpleGeometry from '../geom/SimpleGeometry.js';
import {offset as sphereOffset} from '../sphere.js';
import _ol_geom_flat_area_ from '../geom/flat/area.js';
import _ol_geom_flat_closest_ from '../geom/flat/closest.js';
import _ol_geom_flat_contains_ from '../geom/flat/contains.js';
import _ol_geom_flat_deflate_ from '../geom/flat/deflate.js';
import _ol_geom_flat_inflate_ from '../geom/flat/inflate.js';
import _ol_geom_flat_interiorpoint_ from '../geom/flat/interiorpoint.js';
import _ol_geom_flat_intersectsextent_ from '../geom/flat/intersectsextent.js';
import _ol_geom_flat_orient_ from '../geom/flat/orient.js';
import _ol_geom_flat_simplify_ from '../geom/flat/simplify.js';
import {modulo} from '../math.js';

/**
 * @classdesc
 * Polygon geometry.
 *
 * @constructor
 * @extends {ol.geom.SimpleGeometry}
 * @param {Array.<Array.<ol.Coordinate>>} coordinates Array of linear
 *     rings that define the polygon. The first linear ring of the array
 *     defines the outer-boundary or surface of the polygon. Each subsequent
 *     linear ring defines a hole in the surface of the polygon. A linear ring
 *     is an array of vertices' coordinates where the first coordinate and the
 *     last are equivalent.
 * @param {ol.geom.GeometryLayout=} opt_layout Layout.
 * @api
 */
const Polygon = function(coordinates, opt_layout) {

  SimpleGeometry.call(this);

  /**
   * @type {Array.<number>}
   * @private
   */
  this.ends_ = [];

  /**
   * @private
   * @type {number}
   */
  this.flatInteriorPointRevision_ = -1;

  /**
   * @private
   * @type {ol.Coordinate}
   */
  this.flatInteriorPoint_ = null;

  /**
   * @private
   * @type {number}
   */
  this.maxDelta_ = -1;

  /**
   * @private
   * @type {number}
   */
  this.maxDeltaRevision_ = -1;

  /**
   * @private
   * @type {number}
   */
  this.orientedRevision_ = -1;

  /**
   * @private
   * @type {Array.<number>}
   */
  this.orientedFlatCoordinates_ = null;

  this.setCoordinates(coordinates, opt_layout);

};

inherits(Polygon, SimpleGeometry);


/**
 * Append the passed linear ring to this polygon.
 * @param {ol.geom.LinearRing} linearRing Linear ring.
 * @api
 */
Polygon.prototype.appendLinearRing = function(linearRing) {
  if (!this.flatCoordinates) {
    this.flatCoordinates = linearRing.getFlatCoordinates().slice();
  } else {
    extend(this.flatCoordinates, linearRing.getFlatCoordinates());
  }
  this.ends_.push(this.flatCoordinates.length);
  this.changed();
};


/**
 * Make a complete copy of the geometry.
 * @return {!ol.geom.Polygon} Clone.
 * @override
 * @api
 */
Polygon.prototype.clone = function() {
  const polygon = new Polygon(null);
  polygon.setFlatCoordinates(
    this.layout, this.flatCoordinates.slice(), this.ends_.slice());
  return polygon;
};


/**
 * @inheritDoc
 */
Polygon.prototype.closestPointXY = function(x, y, closestPoint, minSquaredDistance) {
  if (minSquaredDistance < closestSquaredDistanceXY(this.getExtent(), x, y)) {
    return minSquaredDistance;
  }
  if (this.maxDeltaRevision_ != this.getRevision()) {
    this.maxDelta_ = Math.sqrt(_ol_geom_flat_closest_.getsMaxSquaredDelta(
      this.flatCoordinates, 0, this.ends_, this.stride, 0));
    this.maxDeltaRevision_ = this.getRevision();
  }
  return _ol_geom_flat_closest_.getsClosestPoint(
    this.flatCoordinates, 0, this.ends_, this.stride,
    this.maxDelta_, true, x, y, closestPoint, minSquaredDistance);
};


/**
 * @inheritDoc
 */
Polygon.prototype.containsXY = function(x, y) {
  return _ol_geom_flat_contains_.linearRingsContainsXY(
    this.getOrientedFlatCoordinates(), 0, this.ends_, this.stride, x, y);
};


/**
 * Return the area of the polygon on projected plane.
 * @return {number} Area (on projected plane).
 * @api
 */
Polygon.prototype.getArea = function() {
  return _ol_geom_flat_area_.linearRings(
    this.getOrientedFlatCoordinates(), 0, this.ends_, this.stride);
};


/**
 * Get the coordinate array for this geometry.  This array has the structure
 * of a GeoJSON coordinate array for polygons.
 *
 * @param {boolean=} opt_right Orient coordinates according to the right-hand
 *     rule (counter-clockwise for exterior and clockwise for interior rings).
 *     If `false`, coordinates will be oriented according to the left-hand rule
 *     (clockwise for exterior and counter-clockwise for interior rings).
 *     By default, coordinate orientation will depend on how the geometry was
 *     constructed.
 * @return {Array.<Array.<ol.Coordinate>>} Coordinates.
 * @override
 * @api
 */
Polygon.prototype.getCoordinates = function(opt_right) {
  let flatCoordinates;
  if (opt_right !== undefined) {
    flatCoordinates = this.getOrientedFlatCoordinates().slice();
    _ol_geom_flat_orient_.orientLinearRings(
      flatCoordinates, 0, this.ends_, this.stride, opt_right);
  } else {
    flatCoordinates = this.flatCoordinates;
  }

  return _ol_geom_flat_inflate_.coordinatess(
    flatCoordinates, 0, this.ends_, this.stride);
};


/**
 * @return {Array.<number>} Ends.
 */
Polygon.prototype.getEnds = function() {
  return this.ends_;
};


/**
 * @return {Array.<number>} Interior point.
 */
Polygon.prototype.getFlatInteriorPoint = function() {
  if (this.flatInteriorPointRevision_ != this.getRevision()) {
    const flatCenter = getCenter(this.getExtent());
    this.flatInteriorPoint_ = _ol_geom_flat_interiorpoint_.linearRings(
      this.getOrientedFlatCoordinates(), 0, this.ends_, this.stride,
      flatCenter, 0);
    this.flatInteriorPointRevision_ = this.getRevision();
  }
  return this.flatInteriorPoint_;
};


/**
 * Return an interior point of the polygon.
 * @return {ol.geom.Point} Interior point as XYM coordinate, where M is the
 * length of the horizontal intersection that the point belongs to.
 * @api
 */
Polygon.prototype.getInteriorPoint = function() {
  return new Point(this.getFlatInteriorPoint(), GeometryLayout.XYM);
};


/**
 * Return the number of rings of the polygon,  this includes the exterior
 * ring and any interior rings.
 *
 * @return {number} Number of rings.
 * @api
 */
Polygon.prototype.getLinearRingCount = function() {
  return this.ends_.length;
};


/**
 * Return the Nth linear ring of the polygon geometry. Return `null` if the
 * given index is out of range.
 * The exterior linear ring is available at index `0` and the interior rings
 * at index `1` and beyond.
 *
 * @param {number} index Index.
 * @return {ol.geom.LinearRing} Linear ring.
 * @api
 */
Polygon.prototype.getLinearRing = function(index) {
  if (index < 0 || this.ends_.length <= index) {
    return null;
  }
  const linearRing = new LinearRing(null);
  linearRing.setFlatCoordinates(this.layout, this.flatCoordinates.slice(
    index === 0 ? 0 : this.ends_[index - 1], this.ends_[index]));
  return linearRing;
};


/**
 * Return the linear rings of the polygon.
 * @return {Array.<ol.geom.LinearRing>} Linear rings.
 * @api
 */
Polygon.prototype.getLinearRings = function() {
  const layout = this.layout;
  const flatCoordinates = this.flatCoordinates;
  const ends = this.ends_;
  const linearRings = [];
  let offset = 0;
  for (let i = 0, ii = ends.length; i < ii; ++i) {
    const end = ends[i];
    const linearRing = new LinearRing(null);
    linearRing.setFlatCoordinates(layout, flatCoordinates.slice(offset, end));
    linearRings.push(linearRing);
    offset = end;
  }
  return linearRings;
};


/**
 * @return {Array.<number>} Oriented flat coordinates.
 */
Polygon.prototype.getOrientedFlatCoordinates = function() {
  if (this.orientedRevision_ != this.getRevision()) {
    const flatCoordinates = this.flatCoordinates;
    if (_ol_geom_flat_orient_.linearRingsAreOriented(
      flatCoordinates, 0, this.ends_, this.stride)) {
      this.orientedFlatCoordinates_ = flatCoordinates;
    } else {
      this.orientedFlatCoordinates_ = flatCoordinates.slice();
      this.orientedFlatCoordinates_.length =
          _ol_geom_flat_orient_.orientLinearRings(
            this.orientedFlatCoordinates_, 0, this.ends_, this.stride);
    }
    this.orientedRevision_ = this.getRevision();
  }
  return this.orientedFlatCoordinates_;
};


/**
 * @inheritDoc
 */
Polygon.prototype.getSimplifiedGeometryInternal = function(squaredTolerance) {
  const simplifiedFlatCoordinates = [];
  const simplifiedEnds = [];
  simplifiedFlatCoordinates.length = _ol_geom_flat_simplify_.quantizes(
    this.flatCoordinates, 0, this.ends_, this.stride,
    Math.sqrt(squaredTolerance),
    simplifiedFlatCoordinates, 0, simplifiedEnds);
  const simplifiedPolygon = new Polygon(null);
  simplifiedPolygon.setFlatCoordinates(
    GeometryLayout.XY, simplifiedFlatCoordinates, simplifiedEnds);
  return simplifiedPolygon;
};


/**
 * @inheritDoc
 * @api
 */
Polygon.prototype.getType = function() {
  return GeometryType.POLYGON;
};


/**
 * @inheritDoc
 * @api
 */
Polygon.prototype.intersectsExtent = function(extent) {
  return _ol_geom_flat_intersectsextent_.linearRings(
    this.getOrientedFlatCoordinates(), 0, this.ends_, this.stride, extent);
};


/**
 * Set the coordinates of the polygon.
 * @param {Array.<Array.<ol.Coordinate>>} coordinates Coordinates.
 * @param {ol.geom.GeometryLayout=} opt_layout Layout.
 * @override
 * @api
 */
Polygon.prototype.setCoordinates = function(coordinates, opt_layout) {
  if (!coordinates) {
    this.setFlatCoordinates(GeometryLayout.XY, null, this.ends_);
  } else {
    this.setLayout(opt_layout, coordinates, 2);
    if (!this.flatCoordinates) {
      this.flatCoordinates = [];
    }
    const ends = _ol_geom_flat_deflate_.coordinatess(
      this.flatCoordinates, 0, coordinates, this.stride, this.ends_);
    this.flatCoordinates.length = ends.length === 0 ? 0 : ends[ends.length - 1];
    this.changed();
  }
};


/**
 * @param {ol.geom.GeometryLayout} layout Layout.
 * @param {Array.<number>} flatCoordinates Flat coordinates.
 * @param {Array.<number>} ends Ends.
 */
Polygon.prototype.setFlatCoordinates = function(layout, flatCoordinates, ends) {
  this.setFlatCoordinatesInternal(layout, flatCoordinates);
  this.ends_ = ends;
  this.changed();
};

export default Polygon;


/**
 * Create an approximation of a circle on the surface of a sphere.
 * @param {ol.Coordinate} center Center (`[lon, lat]` in degrees).
 * @param {number} radius The great-circle distance from the center to
 *     the polygon vertices.
 * @param {number=} opt_n Optional number of vertices for the resulting
 *     polygon. Default is `32`.
 * @param {number=} opt_sphereRadius Optional radius for the sphere (defaults to
 *     the Earth's mean radius using the WGS84 ellipsoid).
 * @return {ol.geom.Polygon} The "circular" polygon.
 * @api
 */
export function circular(center, radius, opt_n, opt_sphereRadius) {
  const n = opt_n ? opt_n : 32;
  /** @type {Array.<number>} */
  const flatCoordinates = [];
  for (let i = 0; i < n; ++i) {
    extend(flatCoordinates, sphereOffset(center, radius, 2 * Math.PI * i / n, opt_sphereRadius));
  }
  flatCoordinates.push(flatCoordinates[0], flatCoordinates[1]);
  const polygon = new Polygon(null);
  polygon.setFlatCoordinates(GeometryLayout.XY, flatCoordinates, [flatCoordinates.length]);
  return polygon;
}


/**
 * Create a polygon from an extent. The layout used is `XY`.
 * @param {ol.Extent} extent The extent.
 * @return {ol.geom.Polygon} The polygon.
 * @api
 */
export function fromExtent(extent) {
  const minX = extent[0];
  const minY = extent[1];
  const maxX = extent[2];
  const maxY = extent[3];
  const flatCoordinates =
      [minX, minY, minX, maxY, maxX, maxY, maxX, minY, minX, minY];
  const polygon = new Polygon(null);
  polygon.setFlatCoordinates(
    GeometryLayout.XY, flatCoordinates, [flatCoordinates.length]);
  return polygon;
}


/**
 * Create a regular polygon from a circle.
 * @param {ol.geom.Circle} circle Circle geometry.
 * @param {number=} opt_sides Number of sides of the polygon. Default is 32.
 * @param {number=} opt_angle Start angle for the first vertex of the polygon in
 *     radians. Default is 0.
 * @return {ol.geom.Polygon} Polygon geometry.
 * @api
 */
export function fromCircle(circle, opt_sides, opt_angle) {
  const sides = opt_sides ? opt_sides : 32;
  const stride = circle.getStride();
  const layout = circle.getLayout();
  const polygon = new Polygon(null, layout);
  const arrayLength = stride * (sides + 1);
  const flatCoordinates = new Array(arrayLength);
  for (let i = 0; i < arrayLength; i++) {
    flatCoordinates[i] = 0;
  }
  const ends = [flatCoordinates.length];
  polygon.setFlatCoordinates(layout, flatCoordinates, ends);
  makeRegular(polygon, circle.getCenter(), circle.getRadius(), opt_angle);
  return polygon;
}


/**
 * Modify the coordinates of a polygon to make it a regular polygon.
 * @param {ol.geom.Polygon} polygon Polygon geometry.
 * @param {ol.Coordinate} center Center of the regular polygon.
 * @param {number} radius Radius of the regular polygon.
 * @param {number=} opt_angle Start angle for the first vertex of the polygon in
 *     radians. Default is 0.
 */
export function makeRegular(polygon, center, radius, opt_angle) {
  const flatCoordinates = polygon.getFlatCoordinates();
  const layout = polygon.getLayout();
  const stride = polygon.getStride();
  const ends = polygon.getEnds();
  const sides = flatCoordinates.length / stride - 1;
  const startAngle = opt_angle ? opt_angle : 0;
  for (let i = 0; i <= sides; ++i) {
    const offset = i * stride;
    const angle = startAngle + (modulo(i, sides) * 2 * Math.PI / sides);
    flatCoordinates[offset] = center[0] + (radius * Math.cos(angle));
    flatCoordinates[offset + 1] = center[1] + (radius * Math.sin(angle));
  }
  polygon.setFlatCoordinates(layout, flatCoordinates, ends);
}
