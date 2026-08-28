"use client";

import {
 MapContainer,
 TileLayer
} from "react-leaflet";

import "leaflet/dist/leaflet.css";


export default function VisitorMap(){

return (

<section
className="dashboard-panel"
style={{
padding:0,
overflow:"hidden",
height:600
}}
>

<MapContainer

center={[
35.6892,
51.3890
]}

zoom={11}

style={{
height:"100%",
width:"100%"
}}

>

<TileLayer

url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"

attribution="&copy; OpenStreetMap"

/>

</MapContainer>


</section>

);

}