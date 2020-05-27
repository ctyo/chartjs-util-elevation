import * as d3 from 'd3';
import { point } from '@turf/helpers';
import distance from '@turf/distance';
import { color, select } from 'd3';

class Distance {
    distance: number;
    elevation: number;

    constructor(distance: number, elevation: number) {
        this.distance = distance;
        this.elevation = elevation;
    }
}

class Option {
    selector: string;

    color: string;
    fill: string;

    pinColor: string;
    padding: number;

    onHover: any; // hover時

    onSelectStart: any; // 選択時
    onSelectMove: any; // 選択しながら移動時
    onSelectEnd: any; // 選択時完了時

}

export class ElevationGraph {

    private option: Option;

    private distData: Array<Distance>;
    private contents: any;
    private svg: any;
    private tooltip: any;

    constructor(routeData: any, option: Option) {
        this.option = option;
        this.initialize();
        this.update(routeData);
    }

    private initialize() {
        this.contents = d3.select(this.option.selector);
        this.svg = this.contents.append("svg").attr("width", '100%').attr("height", '100%');
        this.tooltip = d3.select(this.option.selector).append("div").attr("class", "chart--tooltip");
    }

    public update(routeData) {

        // fillを埋めるために最初を最後を標高0でセットする
        routeData.unshift(routeData[0]);
        routeData[0][2] = 0;
        routeData.push(routeData[routeData.length - 1]);
        routeData[routeData.length - 1][2] = 0;

        this.distData = this.routeToDistance(routeData);
        this.draw();
    }

    private draw() {
        const self = this;
        let x, y, xScale, yScale, width, height, line, path, area, lineArea, focus, focusLine, focusPoint, overlay, brush, brushX;

        const lineChart = {
            initialize: function () {
                // レンダリング
                this.rendar();
                // アップデート
                this.update();
                // リサイズ時の処理
                this.resize();
                // データ変更の処理
                //this.dataChange();
                // tooltipを設定
                this.setTooltip();
                // マウスイベントをバインド
                this.mouseEvent();

            },
            rendar: function () {
                // エリアを追加
                lineArea = self.svg.append("path");

                // svg要素にg要素を追加しクラスを付与しxに代入
                x = self.svg.append("g")
                    .attr("class", "axis axis-x");

                // svg要素にg要素を追加しクラスを付与しyに代入
                y = self.svg.append("g")
                    .attr("class", "axis axis-y");

                // フォーカス要素のグループを追加
                focus = self.svg.append("g")
                    .attr("class", "focus")
                    .style("visibility", "hidden")

                // フォーカス時のY軸を追加
                focusLine = focus.append("line");

                // フォーカス時のポイントを追加
                focusPoint = focus.append("circle")
                    .attr("r", 4)
                    .attr("fill", "#fff")
                    .attr("stroke", d3.rgb(self.option.pinColor))
                    .attr("stroke-width", 2)

                // オーバーレイ要素を追加
                overlay = self.svg.append("rect");
                brush = self.svg.append("g");

                // パス要素を追加
                path = self.svg.append("path");
            },
            update: function () {
                // グラフの幅
                width = self.contents.node().clientWidth - self.option.padding;
                // グラフの高さ
                height = self.contents.node().clientHeight - self.option.padding;

                // X軸Y軸を追加
                this.addScales();
                // ラインを追加
                this.addLine();
                // エリアを追加
                this.addArea();

            },
            resize: function () {
                let self = this;
                window.addEventListener("resize", function () {
                    // アップデート
                    self.update();
                })
            },
            getLine: function () {
                return d3.line()
                    // lineのX軸をセット
                    .x(function (d: any) { return xScale(d.distance); })
                    // lineのY軸をセット
                    .y(function (d: any) { return yScale(d.elevation); })
                    // カーブを設定
                    .curve(d3.curveCatmullRom.alpha(0.4));
            },
            getArea: function () {
                return d3.area()
                    .x(function (d: any) { return xScale(d.distance); })
                    .y1(yScale(0))
                    .y0(yScale(0))
                    // カーブを設定
                    .curve(d3.curveCatmullRom.alpha(0.4));
            },
            addScales: function () {
                // X軸を時間のスケールに設定する
                xScale = d3.scaleLinear()
                    // 最小値と最大値を指定しX軸の領域を設定する
                    .domain([
                        // 0を最小値として設定
                        0,
                        // データ内の日付の最大値を取得
                        d3.max(self.distData, function (d: any) { return d.distance })
                    ])
                    // SVG内でのX軸の位置の開始位置と終了位置を指定しX軸の幅を設定する
                    .range([self.option.padding, width]);

                // Y軸を値のスケールに設定する
                yScale = d3.scaleLinear()
                    // 最小値と最大値を指定しX軸の領域を設定する
                    .domain([
                        // 標高が0m以下があるので最小を取る
                        d3.min(self.distData, function (d: any) { return d.elevation; }),
                        // データ内のvalueの最大値を取得
                        d3.max(self.distData, function (d: any) { return d.elevation; })
                    ])
                    // SVG内でのY軸の位置の開始位置と終了位置を指定しY軸の幅を設定する
                    .range([height, self.option.padding]);

                // x軸の目盛りの量
                let xTicks = (self.contents.node().clientWidth < 768) ? 6 : 12;

                // x軸の目盛りの量
                let yTicks = (self.contents.node().clientHeight < 300) ? 4 : 12;

                // scaleをセットしてX軸を作成
                let axisx = d3.axisBottom(xScale)
                    // グラフの目盛りの数を設定
                    .ticks(xTicks)
                    // 目盛りの表示フォーマットを設定
                    .tickFormat((d) => {
                        return d === 0 ? '' : d + 'km'
                    });

                // scaleをセットしてY軸を作成
                let axisy = d3.axisLeft(yScale)
                    .ticks(yTicks)
                    .tickSizeInner(-width)
                    .tickFormat((d: any) => {
                        return d === 0 ? d : d + 'm'
                    });



                // X軸の位置を指定し軸をセット
                x.attr("transform", "translate(" + 0 + "," + (height) + ")")
                    .call(axisx);

                // Y軸の位置を指定し軸をセット
                y.attr("transform", "translate(" + self.option.padding + "," + 0 + ")")
                    .call(axisy);


            },
            addLine: function () {
                //lineを生成
                line = this.getLine();
                path
                    // dataをセット
                    .datum(self.distData)
                    // strokeカラーを設定
                    .attr("stroke", d3.rgb(self.option.color))
                    .attr("fill", d3.rgb(self.option.fill))
                    // strokeカラーを設定
                    .attr("stroke-width", 2)
                    // fillした場合も後ろにイベントを透過するように変更
                    .style("pointer-events", "none")
                    // d属性を設定
                    .attr("d", line)
            },
            addArea: function () {

                area = this.getArea();

                lineArea
                    .datum(self.distData)
                    .attr("d", area)
                //                .style("fill", color)


            },
            setTooltip: function () {
                // オーバーレイ要素を設定
                overlay
                    .style("fill", "none")
                    .style("pointer-events", "all")
                    .attr("class", "overlay")
                    .attr("width", width)
                    .attr("height", height)

                // フォーカスした際のY軸を設定
                focusLine
                    .style("stroke", "#ccc")
                    .style("stroke-width", "1px")
                    .style("stroke-dasharray", "2")
                    .attr("class", "x-hover-line hover-line")
                    .attr("y1", self.option.padding)
                    .attr("y2", height)

                // 選択範囲領域
                brush
                    .attr("class", "brush")
                    .attr("y1", self.option.padding)
                    .attr("y2", height)

                brushX = d3.brushX().extent([[self.option.padding, 0], [width, height]]);
            },
            mouseEvent: function () {

                const getPointer = (selection) => {
                    const bisectDate = d3.bisector(function (d: any) { return d.distance; }).left;
                    let x0 = xScale.invert(selection),
                        i = bisectDate(self.distData, x0, 1),
                        d0 = self.distData[i - 1],
                        d1 = self.distData[i],
                        j = x0 - d0.distance > d1.distance - x0 ? i - 1 : i
                    return j
                };

                brush.call(brushX);
                // overlayイベントだがbrushがイベントを食べるのでこちらで発火
                brush.on("mousemove", this.handleMouseMove)
                    .on("mouseout", this.handleMouseOut);

                if (self.option.onSelectStart) {
                    brushX.on('start', () => {
                        const selection = d3.event.selection ? d3.event.selection[0] : d3.event.sourceEvent.clientX;
                        self.option.onSelectStart.call(this, d3.event, getPointer(selection))
                    })
                }

                if (self.option.onSelectEnd) {
                    brushX.on('end', () => {
                        const selection = d3.event.selection ? d3.event.selection[1] : d3.event.sourceEvent.clientX;
                        self.option.onSelectEnd.call(this, d3.event, getPointer(selection))
                    })
                }
                if (self.option.onSelectMove) {
                    brushX.on('brush', () => {
                        self.option.onSelectMove.call(this, d3.event,
                            getPointer(d3.event.selection[0]),
                            getPointer(d3.event.selection[1])
                        )
                    })
                }

            },
            handleMouseMove: function () {
                const bisectDate = d3.bisector(function (d: any) { return d.distance; }).left;
                let x0 = xScale.invert(d3.mouse(this)[0]),
                    i = bisectDate(self.distData, x0, 1),
                    d0 = self.distData[i - 1],
                    d1 = self.distData[i],
                    j = x0 - d0.distance > d1.distance - x0 ? i - 1 : i,
                    d = self.distData[j];

                let tooltipY = (d3.event.layerY - 40);
                let tooltipX = (d3.event.layerX + 20);

                if ((window.innerWidth - 160) < tooltipX) {
                    tooltipX = (d3.event.layerX - 200);
                }

                self.tooltip
                    .html("")
                    .style("visibility", "visible")
                    .style("top", tooltipY + "px")
                    .style("left", tooltipX + "px")

                self.tooltip
                    .append("div")
                    .attr("class", "tooltip--time")
                    .html(d3.format(".2f")(d.distance) + 'km<br>' + d.elevation + '<small>m</small>')

                focus
                    .style("visibility", "visible")
                    .attr("transform", "translate(" + xScale(d.distance) + "," + 0 + ")");

                focusPoint.attr("transform", "translate(" + 0 + "," + yScale(d.elevation) + ")")

                // hover user event
                if (self.option.onHover) {
                    self.option.onHover.call(this, d, j)
                }

            },
            handleMouseOut: function (d, i) {
                self.tooltip.style("visibility", "hidden");
                focus.style("visibility", "hidden");
            },
        };

        lineChart.initialize();
    }

    private routeToDistance(route): Array<Distance> {
        let dist = [];
        let odo = 0;
        for (let i = 0, len = route.length; i < len; i++) {
            if (i === 0) {
                dist.push(new Distance(0, route[i][2]));
                continue;
            }
            const from = point(route[i - 1]);
            const to = point(route[i]);
            odo += distance(from, to);
            dist.push(new Distance(odo, route[i][2]));
        }
        return dist;
    }

}

