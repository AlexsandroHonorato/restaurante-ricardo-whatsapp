<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class AlertaSaude extends Mailable
{
    /** @param list<array{codigo: string, mensagem: string}> $problemas */
    public function __construct(public array $problemas) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: '[BotClient] '.count($this->problemas).' problema(s) em '.config('services.empresa.nome'));
    }

    public function content(): Content
    {
        $itens = implode('', array_map(fn ($p) => '<li>'.e($p['mensagem']).'</li>', $this->problemas));
        $url = e((string) config('app.url'));

        return new Content(htmlString: '<p>Atenção: o BotClient de '.e(config('services.empresa.nome')).' precisa de verificação.</p>'
            ."<ul>{$itens}</ul><p>Painel: <a href=\"{$url}\">{$url}</a></p>");
    }
}
