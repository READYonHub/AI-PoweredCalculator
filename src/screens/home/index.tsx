import { useEffect, useRef, useState } from "react";
import { ColorSwatch, Group } from "@mantine/core";
import axios from "axios";
import { SWATCHES } from "../../../constans.tsx";
import { Button } from "../../components/ui/button.tsx";
import Draggable from "react-draggable";

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("rgb(255, 255, 255)");
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult | null>(null);
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax && window.MathJax.Hub) {
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            console.log("Updated result:", result);
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(null);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.lineCap = "round";
                ctx.lineWidth = 3;
            }
        }

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML";
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: { inlineMath: [["$", "$"], ["\\(", "\\)"]] },
            });
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression((prevLatex) => [...prevLatex, latex]);
        console.log("Updated LaTeX expressions:", latexExpression);
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = "black";
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                setIsDrawing(true);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.strokeStyle = color;
                ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                ctx.stroke();
            }
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const runRoute = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            const response = await axios.post(`${import.meta.env.VITE_API_URL}/calculate`, {
                image: canvas.toDataURL("image/png"),
                dict_of_vars: dictOfVars,
            });

            const resp = response.data;
            console.log("Response:", resp);

            const newResults: GeneratedResult[] = resp.data.map((data: Response) => ({
                expression: data.expr,
                answer: data.result,
            }));

            if (newResults.length > 0) {
                setResult(newResults[0]);
            }

            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
            const ctx = canvas.getContext("2d");
            const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    if (imageData.data[i + 3] > 0) { // Pixel is not transparent
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            setLatexPosition({ x: centerX, y: centerY });

        } catch (error) {
            console.error("Error calling API:", error);
        }
    };

    return (
        <>
            <div className="grid grid-cols-3 gap-2">
                <Button onClick={() => setReset(true)} className="z-20 bg-black text-white">
                    Reset
                </Button>
                <Group className="z-20">
                    {SWATCHES.map((swatch) => (
                        <ColorSwatch key={swatch} color={swatch} onClick={() => setColor(swatch)} />
                    ))}
                </Group>
                <Button onClick={runRoute} className="z-20 bg-black text-white">
                    Run
                </Button>
            </div>
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />

            {latexExpression.map((latex, index) => (
                <Draggable key={index} defaultPosition={latexPosition} onStop={(e, data) => setLatexPosition({ x: data.x, y: data.y })}>
                    <div className="absolute p-2 text-white rounded shadow-md">
                        <div className="latex-content">{latex}</div>
                    </div>
                </Draggable>
            ))}
        </>
    );
}
